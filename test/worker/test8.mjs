import assert from "node:assert";
const warns = [];
const realWarn = console.warn;
console.warn = (...args) => warns.push(args.join(" "));
globalThis.chrome = { storage: { local: { get: async () => ({}) } } };
const { parseZohoTimestamp, computeWorkedMs, findCheckin } = await import("../../src/lib/policy.js");

// 1. unknown format -> null, not a guessed Date
assert.strictEqual(parseZohoTimestamp("garbage-value"), null);
assert.strictEqual(parseZohoTimestamp("2026/09/10"), null);
assert.strictEqual(parseZohoTimestamp("-"), null, "placeholder is null, never warned");
console.log("1 OK  unknown formats return null");

// 2. warn-once: same bad value parsed 100 times -> one warning
const before = warns.length;
for (let i = 0; i < 100; i++) parseZohoTimestamp("garbage-value");
assert.strictEqual(warns.length, before, "repeat parses of a seen value are silent");
assert.strictEqual(warns.filter((w) => w.includes("garbage-value")).length, 1);
assert.strictEqual(warns.filter((w) => w.includes("-")).filter((w) => w.includes("skipped: -")).length, 0, "placeholder never warned");
console.log("2 OK  warn-once:", warns.length, "warnings total for 100+ parses");

// 3. AM/PM and seconds variants
let d = parseZohoTimestamp("10-Sep-2026 - 02:15 PM");
assert.strictEqual(d.getHours(), 14);
d = parseZohoTimestamp("10-Sep-2026 - 12:05 AM");
assert.strictEqual(d.getHours(), 0, "12 AM is midnight");
d = parseZohoTimestamp("10-Sep-2026 - 12:05 PM");
assert.strictEqual(d.getHours(), 12, "12 PM is noon");
d = parseZohoTimestamp("10-Sep-2026 - 09:29:45");
assert.strictEqual(d.getSeconds(), 45);
console.log("3 OK  AM/PM + seconds variants");

// 4. corrupt entries degrade gracefully
const now = new Date(2026, 8, 10, 15, 0, 0);
const mixed = computeWorkedMs(
  [{ fdate: "corrupt", tdate: "corrupt" }, { fdate: "2026-09-10 13:00:00", tdate: "-" }],
  now
);
assert.strictEqual(mixed.workedMs, 2 * 3600 * 1000, "corrupt pair skipped, open session counted");
const checkin = findCheckin(
  { entries: { "2026-09-10": [{ fdate: "corrupt" }, { fdate: "2026-09-10 09:00:00" }] } },
  now
);
assert.strictEqual(checkin.getHours(), 9, "findCheckin skips unparseable entries");
console.log("4 OK  corrupt entries skipped, usable ones kept");
console.warn = realWarn;
console.log("\nAll strict-parser assertions passed.");
