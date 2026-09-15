import assert from "node:assert";

// ---- computeWorked reads the day Zoho states, not the punch rows
globalThis.chrome = { storage: { local: { get: async () => ({}) } } };
const {
  computeWorked,
  computeTargets,
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

// ---- part-day leave shortens the work, never the break
const leaveCheckin = new Date(2026, 8, 15, 11, 12, 0);
const hhmm = (d) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

// a whole day is untouched: 11:12 + 9.25h and + 7.25h, exactly as before
let leaveTargets = computeTargets(leaveCheckin, DEFAULT_POLICY, 1);
assert.strictEqual(hhmm(leaveTargets.fullTime), "20:27");
assert.strictEqual(hhmm(leaveTargets.partTime), "18:27");
console.log("10 OK  fraction 1 leaves the offsets exactly as they were");

// 0.25 day leave: 0.75 x 8h of work, plus the whole 1h15m break
leaveTargets = computeTargets(leaveCheckin, DEFAULT_POLICY, 0.75);
assert.strictEqual(
  hhmm(leaveTargets.fullTime),
  "18:27",
  "full-time is 1h15m break + 6h work after 11:12",
);
assert.strictEqual(hhmm(leaveTargets.partTime), "16:57");
console.log(
  "11 OK  0.25 leave pulls full-time 20:27 -> 18:27, break kept whole",
);

// a late start carries no break in its offsets, so the work scales alone
leaveTargets = computeTargets(
  new Date(2026, 8, 15, 14, 0, 0),
  DEFAULT_POLICY,
  0.75,
);
assert.strictEqual(hhmm(leaveTargets.fullTime), "20:00", "14:00 + 0.75 x 8h");
console.log(
  "12 OK  late start has no break to keep, so 0.75 x 8h stands alone",
);

// and it reaches the popup and the worker through computeEffectiveTargets
const leaveData = {
  dayList: {
    0: {
      orgdate: "2026-09-15",
      tsecs: 27960,
      leaveDaysTaken: 0.25,
      status: "0.25 day Paid Leave(Annual Leave$1$), 0.75 day Present",
      filo: { checkin: "2026-09-15 11:12:00", checkout: "2026-09-15 20:13:00" },
    },
  },
};
const effective = computeEffectiveTargets(
  leaveData,
  { checkin: leaveCheckin, isFromYesterday: false },
  new Date(2026, 8, 15, 12, 0, 0),
  DEFAULT_POLICY,
);
assert.strictEqual(
  hhmm(effective.fullTime),
  "18:27",
  "the badge and the gates read the pro-rated target too",
);
console.log("13 OK  computeEffectiveTargets pro-rates, so gates fire on time");

console.log("\nworked time reads the day record, not the punch rows.");
