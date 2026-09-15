import assert from "node:assert";

// ---- computeWorked reads the day Zoho states, not the punch rows
globalThis.chrome = { storage: { local: { get: async () => ({}) } } };
const {
  computeWorked,
  computeWorkedTargets,
  computeEffectiveTargets,
  findDay,
  DEFAULT_POLICY,
} = await import("../../src/lib/policy.ts");

const now = new Date(2026, 8, 11, 15, 0, 0);
const HOUR = 3600 * 1000;
const day = (filo, extra = {}) => ({ orgdate: "2026-09-11", filo, ...extra });

// open session: no checkout yet, so worked runs against the clock
let result = computeWorked(day({ checkin: "2026-09-11 09:00:00" }), now);
assert.strictEqual(result.workedMs, 6 * HOUR);
assert.strictEqual(result.isOpen, true);
console.log("1 OK  open session: 09:00 -> now = 6h, open");

// open session minus an unpaid break
result = computeWorked(
  day({ checkin: "2026-09-11 09:00:00" }, { totalUnPaidBreakInSecs: 3600 }),
  now,
);
assert.strictEqual(result.workedMs, 5 * HOUR);
assert.strictEqual(result.isOpen, true);
console.log("2 OK  open session less a 1h unpaid break = 5h");

// closed day: tsecs is Zoho's own total and wins outright
result = computeWorked(
  day(
    { checkin: "2026-09-11 09:00:00", checkout: "2026-09-11 14:00:00" },
    { tsecs: 5 * 3600, totalUnPaidBreakInSecs: 3600 },
  ),
  now,
);
assert.strictEqual(result.workedMs, 5 * HOUR);
assert.strictEqual(result.isOpen, false);
console.log("3 OK  closed day: tsecs wins over the span arithmetic");

// closed day with no tsecs: fall back to span minus unpaid break
result = computeWorked(
  day(
    { checkin: "2026-09-11 09:00:00", checkout: "2026-09-11 14:00:00" },
    { totalUnPaidBreakInSecs: 3600 },
  ),
  now,
);
assert.strictEqual(result.workedMs, 4 * HOUR);
assert.strictEqual(result.isOpen, false);
console.log("4 OK  closed day without tsecs: 5h span - 1h break = 4h");

// Zoho echoes the punch as checkout == checkin; that is an open day, not a 0h one
result = computeWorked(
  day({ checkin: "2026-09-11 09:00:00", checkout: "2026-09-11 09:00:00" }),
  now,
);
assert.strictEqual(result.workedMs, 6 * HOUR);
assert.strictEqual(result.isOpen, true);
console.log("5 OK  checkout == checkin reads as open, not as a zero-hour day");

// a day with no check-in at all
assert.strictEqual(computeWorked(day({}), now), null);
assert.strictEqual(computeWorked(null, now), null);
console.log("6 OK  no check-in, no worked time");

// worked targets: 5h done of 8h -> full day 3h from now (18:00)
const targets = computeWorkedTargets(
  day({ checkin: "2026-09-11 09:00:00" }, { totalUnPaidBreakInSecs: 3600 }),
  now,
  DEFAULT_POLICY,
);
assert.strictEqual(targets.fullTime.getHours(), 18);
assert.strictEqual(targets.partTime.getHours(), 16);
console.log("7 OK  worked targets: part 16:00, full 18:00");

// effective targets honour the mode, and fall back when the session is closed
const attendanceData = {
  dayList: {
    0: day(
      { checkin: "2026-09-11 09:00:00" },
      { totalUnPaidBreakInSecs: 3600 },
    ),
  },
};
const active = {
  checkin: new Date(2026, 8, 11, 9, 0, 0),
  isFromYesterday: false,
};
assert.strictEqual(
  findDay(attendanceData, active.checkin).orgdate,
  "2026-09-11",
);
assert.strictEqual(findDay(attendanceData, new Date(2026, 8, 12)), null);

const offsetMode = computeEffectiveTargets(
  attendanceData,
  active,
  now,
  DEFAULT_POLICY,
);
assert.strictEqual(offsetMode.fullTime.getHours(), 18);
assert.strictEqual(
  offsetMode.fullTime.getMinutes(),
  15,
  "offset mode: 09:00 + 9.25h = 18:15",
);
const workedMode = computeEffectiveTargets(attendanceData, active, now, {
  ...DEFAULT_POLICY,
  targetMode: "worked",
});
assert.strictEqual(workedMode.fullTime.getHours(), 18);
assert.strictEqual(
  workedMode.fullTime.getMinutes(),
  0,
  "worked mode: 3h of work left = 18:00",
);
const closedData = {
  dayList: {
    0: day(
      { checkin: "2026-09-11 09:00:00", checkout: "2026-09-11 14:00:00" },
      { tsecs: 5 * 3600 },
    ),
  },
};
const closedMode = computeEffectiveTargets(closedData, active, now, {
  ...DEFAULT_POLICY,
  targetMode: "worked",
});
assert.strictEqual(
  closedMode.fullTime.getMinutes(),
  15,
  "closed session falls back to offset",
);
console.log(
  "8 OK  effective targets: offset 18:15, worked 18:00, closed falls back",
);

// ---- regression: the captured 2026-09-15 payload, which read as 1h15m
// (the unpaid lunch break) because the old model summed punch rows.
const realDay = {
  orgdate: "2026-09-15",
  tsecs: 27960,
  tHrs: "07:46",
  totalUnPaidBreakInSecs: 4500,
  status: "0.25 day Paid Leave(Annual Leave$1$), 0.75 day Present",
  filo: {
    checkin: "2026-09-15 11:12:00",
    checkout: "2026-09-15 20:13:00",
  },
};
const real = computeWorked(realDay, new Date(2026, 8, 15, 21, 49, 0));
assert.strictEqual(real.isOpen, false);
assert.notStrictEqual(
  real.workedMs,
  4500 * 1000,
  "must not report the lunch break",
);
assert.strictEqual(real.workedMs, 27960 * 1000);
assert.strictEqual(
  (20 * 60 + 13 - (11 * 60 + 12)) * 60 - 4500,
  27960,
  "checkout - checkin - unpaid break reconciles with tsecs",
);
console.log("9 OK  2026-09-15 regression: 7h46m, not the 1h15m lunch break");

console.log("\nworked time reads the day record, not the punch rows.");
