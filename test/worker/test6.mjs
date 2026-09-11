import assert from "node:assert";
globalThis.chrome = { storage: { local: { get: async () => ({}) } } };
const { parseZohoTimestamp, computeWorkedMs, isZohoDate, isPlaceholderTime } = await import("../../src/lib/policy.ts");

// the live format from the user's worker console
let parsed = parseZohoTimestamp("10-Sep-2026 - 09:29");
assert.strictEqual(parsed.getFullYear(), 2026);
assert.strictEqual(parsed.getMonth(), 8);
assert.strictEqual(parsed.getDate(), 10);
assert.strictEqual(parsed.getHours(), 9);
assert.strictEqual(parsed.getMinutes(), 29);
console.log("1 OK  live format parses:", parsed.toString().slice(0, 24));

parsed = parseZohoTimestamp("10-Sep-2026");
assert.strictEqual(parsed.getHours(), 0);
assert.strictEqual(parsed.getDate(), 10);
assert.ok(isZohoDate("10-Sep-2026 - 09:29") && isZohoDate("2026-09-10"));
assert.ok(isPlaceholderTime("-") && isPlaceholderTime(" - ") && !isPlaceholderTime("10-Sep-2026"));
console.log("2 OK  date-only, isZohoDate, placeholder detection");

// exactly the user's live day: one closed pair + one open with tdate "-"
const now = new Date(2026, 8, 10, 15, 0, 0);
const live = computeWorkedMs(
  [
    { fdate: "10-Sep-2026 - 09:29", tdate: "10-Sep-2026 - 11:53" },
    { fdate: "10-Sep-2026 - 13:00", tdate: "-" },
  ],
  now
);
const expectedMs = (2 * 60 + 24) * 60 * 1000 + 2 * 3600 * 1000; // 2h24 closed + 2h open
assert.strictEqual(live.workedMs, expectedMs, `got ${live.workedMs / 3600000}h`);
assert.strictEqual(live.isOpen, true, "tdate '-' must read as an open session");
assert.ok(Number.isFinite(live.workedMs), "no NaN from the placeholder");
console.log("3 OK  live pair+placeholder day: 4h24m worked, open — no NaN");

// ISO fixtures must keep working
const iso = computeWorkedMs(
  [{ fdate: "2026-09-10 09:00:00", tdate: "2026-09-10 12:00:00" }, { fdate: "2026-09-10 13:00:00" }],
  now
);
assert.strictEqual(iso.workedMs, 5 * 3600 * 1000);
console.log("4 OK  ISO fixtures unchanged");
console.log("\nAll live-format assertions passed.");
