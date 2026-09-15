import assert from "node:assert";
const warns = [];
const realWarn = console.warn;
console.warn = (...args) => warns.push(args.join(" "));
globalThis.chrome = { storage: { local: { get: async () => ({}) } } };
const { parseZohoTimestamp, computeWorked, findCheckin } =
  await import("../../src/lib/policy.ts");

// 1. unknown format -> null, not a guessed Date
assert.strictEqual(parseZohoTimestamp("garbage-value"), null);
assert.strictEqual(parseZohoTimestamp("2026/09/10"), null);
assert.strictEqual(
  parseZohoTimestamp("-"),
  null,
  "placeholder is null, never warned",
);
console.log("1 OK  unknown formats return null");

// 2. warn-once: same bad value parsed 100 times -> one warning
const before = warns.length;
for (let i = 0; i < 100; i++) parseZohoTimestamp("garbage-value");
assert.strictEqual(
  warns.length,
  before,
  "repeat parses of a seen value are silent",
);
assert.strictEqual(warns.filter((w) => w.includes("garbage-value")).length, 1);
assert.strictEqual(
  warns.filter((w) => w.includes("-")).filter((w) => w.includes("skipped: -"))
    .length,
  0,
  "placeholder never warned",
);
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

// 4. a corrupt day record degrades gracefully rather than guessing
const now = new Date(2026, 8, 10, 15, 0, 0);
const corruptCheckout = computeWorked(
  {
    orgdate: "2026-09-10",
    filo: { checkin: "2026-09-10 13:00:00", checkout: "corrupt" },
  },
  now,
);
assert.strictEqual(
  corruptCheckout.workedMs,
  2 * 3600 * 1000,
  "unparseable checkout reads as still open, not as a closed zero-hour day",
);
assert.strictEqual(corruptCheckout.isOpen, true);
assert.strictEqual(
  computeWorked({ orgdate: "2026-09-10", filo: { checkin: "corrupt" } }, now),
  null,
  "unparseable check-in yields no worked time at all",
);
const checkin = findCheckin(
  {
    dayList: {
      0: { orgdate: "2026-09-10", filo: { checkin: "2026-09-10 09:00:00" } },
    },
  },
  now,
);
assert.strictEqual(checkin.getHours(), 9, "findCheckin reads filo.checkin");
assert.strictEqual(
  findCheckin({ dayList: { 0: { orgdate: "2026-09-09" } } }, now),
  null,
  "a day record for another date is not today's check-in",
);
console.log("4 OK  corrupt day record degrades, never guesses");
console.warn = realWarn;
console.log("\nAll strict-parser assertions passed.");
