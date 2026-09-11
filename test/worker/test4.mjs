import assert from "node:assert";

// ---- computeWorkedMs across both possible Zoho entry shapes
globalThis.chrome = { storage: { local: { get: async () => ({}) } } };
const { computeWorkedMs, computeWorkedTargets, computeEffectiveTargets, DEFAULT_POLICY } =
  await import("../../src/lib/policy.ts");

const now = new Date(2026, 8, 11, 15, 0, 0);
const HOUR = 3600 * 1000;

// pair shape: closed 09-12 morning + open since 13:00
let result = computeWorkedMs(
  [{ fdate: "2026-09-11 09:00:00", tdate: "2026-09-11 12:00:00" }, { fdate: "2026-09-11 13:00:00" }],
  now
);
assert.strictEqual(result.workedMs, 5 * HOUR);
assert.strictEqual(result.isOpen, true);
console.log("1 OK  pair shape: 3h closed + 2h open = 5h, open");

// punch shape: in 09:00, out 12:00, in 13:00 (odd punch = open)
result = computeWorkedMs(
  [{ fdate: "2026-09-11 09:00:00" }, { fdate: "2026-09-11 12:00:00" }, { fdate: "2026-09-11 13:00:00" }],
  now
);
assert.strictEqual(result.workedMs, 5 * HOUR);
assert.strictEqual(result.isOpen, true);
console.log("2 OK  punch shape: same day reads identically");

// the degenerate single entry: worked collapses to elapsed — the case the
// side-by-side display exists to expose
result = computeWorkedMs([{ fdate: "2026-09-11 09:00:00" }], now);
assert.strictEqual(result.workedMs, 6 * HOUR);
assert.strictEqual(result.isOpen, true);
console.log("3 OK  single entry degenerates to elapsed (6h)");

// fully closed day: worked frozen, no open session
result = computeWorkedMs(
  [{ fdate: "2026-09-11 09:00:00", tdate: "2026-09-11 14:00:00" }],
  now
);
assert.strictEqual(result.workedMs, 5 * HOUR);
assert.strictEqual(result.isOpen, false);
console.log("4 OK  closed day: 5h frozen, not open");

// worked targets: 5h done of 8h -> full day 3h from now (18:00)
const targets = computeWorkedTargets(
  [{ fdate: "2026-09-11 09:00:00", tdate: "2026-09-11 12:00:00" }, { fdate: "2026-09-11 13:00:00" }],
  now, DEFAULT_POLICY
);
assert.strictEqual(targets.fullTime.getHours(), 18);
assert.strictEqual(targets.partTime.getHours(), 16);
console.log("5 OK  worked targets: part 16:00, full 18:00");

// effective targets honor the mode, and fall back when the session is closed
const attendanceData = { entries: { "2026-09-11": [
  { fdate: "2026-09-11 09:00:00", tdate: "2026-09-11 12:00:00" }, { fdate: "2026-09-11 13:00:00" },
] } };
const active = { checkin: new Date(2026, 8, 11, 9, 0, 0), isFromYesterday: false };
const offsetMode = computeEffectiveTargets(attendanceData, active, now, DEFAULT_POLICY);
assert.strictEqual(offsetMode.fullTime.getHours(), 18);
assert.strictEqual(offsetMode.fullTime.getMinutes(), 15, "offset mode: 09:00 + 9.25h = 18:15");
const workedMode = computeEffectiveTargets(attendanceData, active, now, { ...DEFAULT_POLICY, targetMode: "worked" });
assert.strictEqual(workedMode.fullTime.getHours(), 18);
assert.strictEqual(workedMode.fullTime.getMinutes(), 0, "worked mode: 3h of work left = 18:00");
const closedData = { entries: { "2026-09-11": [{ fdate: "2026-09-11 09:00:00", tdate: "2026-09-11 14:00:00" }] } };
const closedMode = computeEffectiveTargets(closedData, active, now, { ...DEFAULT_POLICY, targetMode: "worked" });
assert.strictEqual(closedMode.fullTime.getMinutes(), 15, "closed session falls back to offset");
console.log("6 OK  effective targets: offset 18:15, worked 18:00, closed->fallback 18:15");

console.log("\nAll worked-model assertions passed.");
