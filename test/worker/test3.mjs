import assert from "node:assert";

// Mock the clock: the midnight-fallback path only exists in the first hours
// after a date rollover, which a test running at 11am cannot reach otherwise.
let fakeNow = new Date(2026, 8, 11, 0, 20, 0).getTime();
const RealDate = Date;
class FakeDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) {
      super(fakeNow);
    } else {
      super(...args);
    }
  }
  static now() {
    return fakeNow;
  }
}
globalThis.Date = FakeDate;

const store = new Map();
const calls = {
  alarmsCreated: [],
  notifications: [],
  badge: [],
  badgeColor: [],
  titles: [],
};
const listeners = {};
const reg = (name) => ({
  addListener: (fn) => {
    listeners[name] = fn;
  },
});
globalThis.chrome = {
  storage: {
    local: {
      get: async (k) =>
        Object.fromEntries(
          (Array.isArray(k) ? k : [k]).map((x) => [x, store.get(x)]),
        ),
      set: async (o) => {
        for (const [k, v] of Object.entries(o)) store.set(k, v);
      },
      remove: async (k) => {
        (Array.isArray(k) ? k : [k]).forEach((x) => store.delete(x));
      },
    },
    onChanged: reg("storageChanged"),
  },
  cookies: {
    getAll: async () => [
      { name: "CSRF_TOKEN", value: "t", domain: "people.zoho.com" },
    ],
    onChanged: reg("c"),
  },
  alarms: {
    create: (name, info) => calls.alarmsCreated.push({ name, ...info }),
    clear: async () => {},
    get: async () => undefined,
    onAlarm: reg("alarm"),
  },
  action: {
    setBadgeText: async (o) => calls.badge.push(o.text),
    setBadgeBackgroundColor: async (o) => calls.badgeColor.push(o.color),
    setTitle: async (o) => calls.titles.push(o.title),
  },
  notifications: {
    create: (id, o) => calls.notifications.push({ id, ...o }),
    clear: () => {},
    onButtonClicked: reg("nb"),
  },
  runtime: {
    onInstalled: reg("i"),
    onStartup: reg("s"),
    onMessage: reg("message"),
    getURL: (p) => p,
  },
};

const key = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
let payload = null;
globalThis.fetch = async () => ({ ok: true, json: async () => payload });

await import("../../src/worker/background.ts");
const send = () =>
  new Promise((r) => listeners.message({ action: "updateAttendance" }, {}, r));

// ---- Phase 1: 00:20, yesterday's 16:30 late start -> full-time 00:30 still running
payload = {
  dayList: { 0: { orgdate: "2026-09-10", tsecs: 7 * 3600 } },
  entries: { "2026-09-10": [{ fdate: "2026-09-10 16:30:00" }] },
};
let res = await send();
assert.strictEqual(res.status, "success");
const armed = calls.alarmsCreated.filter((a) => a.name.startsWith("gate:"));
assert.deepStrictEqual(
  armed.map((a) => a.name),
  ["gate:fullTime"],
  "only the still-future gate arms",
);
assert.strictEqual(
  Math.round((armed[0].when - fakeNow) / 60000),
  10,
  "full-time gate at 00:30",
);
const longDays = calls.notifications.filter((n) => n.id.startsWith("longDay:"));
assert.strictEqual(longDays.length, 1, "long-day heads-up fired");
assert.match(longDays[0].message, /past 19:30/);
assert.strictEqual(
  longDays[0].id,
  "longDay:2026-09-11",
  "dedup key is today's date",
);
assert.strictEqual(calls.badge.at(-1), "10m");
assert.strictEqual(
  calls.badgeColor.at(-1),
  "#cc241d",
  "badge red past the threshold",
);
assert.match(calls.titles.at(-1), /Full-time at/);
console.log(
  "1 OK  midnight fallback: gate",
  armed[0].name,
  "@+10m, badge 10m red, long-day pinged once",
);

// ---- Phase 2: a second refresh must not repeat the long-day ping
await send();
assert.strictEqual(
  calls.notifications.filter((n) => n.id.startsWith("longDay:")).length,
  1,
  "long-day deduped",
);
console.log("2 OK  long-day heads-up not repeated");

// ---- Phase 3: the gate fires at 00:31 off yesterday's check-in
fakeNow = new Date(2026, 8, 11, 0, 31, 0).getTime();
await listeners.alarm({ name: "gate:fullTime" });
const gateNotes = calls.notifications.filter(
  (n) => !n.id.startsWith("longDay:"),
);
assert.strictEqual(gateNotes.length, 1, "gate notification fired");
assert.match(gateNotes[0].message, /Full-time target/);
assert.strictEqual(
  calls.badge.at(-1),
  "",
  "badge clears once the past-midnight day is over",
);
assert.match(calls.titles.at(-1), /no check-in/);
console.log(
  "3 OK  gate fired past midnight:",
  JSON.stringify(gateNotes[0].message),
);

// ---- Phase 4: an ordinary early day raises no long-day ping
store.clear();
calls.alarmsCreated.length = 0;
fakeNow = new Date(2026, 8, 11, 11, 0, 0).getTime();
payload = {
  dayList: { 0: { orgdate: "2026-09-11", tsecs: 2 * 3600 } },
  entries: { "2026-09-11": [{ fdate: "2026-09-11 09:00:00" }] },
};
res = await send();
assert.strictEqual(res.status, "success");
assert.strictEqual(
  calls.notifications.filter((n) => n.id.startsWith("longDay:")).length,
  1,
  "no new long-day ping",
);
assert.strictEqual(
  calls.alarmsCreated.filter((a) => a.name.startsWith("gate:")).length,
  2,
  "both gates armed",
);
assert.strictEqual(
  calls.badgeColor.at(-1),
  "#665c54",
  "badge stays neutral before the threshold",
);
console.log("4 OK  09:00 start: two gates, neutral badge, no long-day ping");

// ---- Phase 5: policy change re-arms gates without a network fetch
calls.alarmsCreated.length = 0;
let fetched = 0;
globalThis.fetch = async () => {
  fetched++;
  return { ok: true, json: async () => payload };
};
store.set("policy", { earlyFullTimeHours: 10 });
await listeners.storageChanged(
  { policy: { newValue: { earlyFullTimeHours: 10 } } },
  "local",
);
assert.strictEqual(fetched, 0, "no refetch on policy change");
const rearmed = calls.alarmsCreated.filter((a) => a.name === "gate:fullTime");
assert.strictEqual(rearmed.length, 1);
assert.strictEqual(
  Math.round((rearmed[0].when - fakeNow) / 3600000),
  8,
  "full-time now 10h after 09:00 = 19:00",
);
console.log("5 OK  policy change re-armed full-time gate at +8h, zero fetches");

console.log("\nAll fallback/long-day assertions passed.");
