import assert from "node:assert";
const store = new Map();
const calls = { alarmsCreated: [], notifications: [], badge: [] };
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
        store.delete(k);
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
    setBadgeBackgroundColor: async () => {},
    setTitle: async () => {},
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

// Frozen at 16:00: run live past ~18:15 and full-time crosses 19:30, arming the long-day gate.
const frozen = new Date();
frozen.setHours(16, 0, 0, 0);
const RealDate = Date;
globalThis.Date = class extends RealDate {
  constructor(...args) {
    super(...(args.length ? args : [frozen.getTime()]));
  }
  static now() {
    return frozen.getTime();
  }
};

const now = new Date();
const key = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// Checked in 8h ago: part-time (+7.25h) has already passed, full-time (+9.25h) has not.
const checkin = new Date(now.getTime() - 8 * 3600 * 1000);
const fdate = `${key(checkin)} ${String(checkin.getHours()).padStart(2, "0")}:${String(checkin.getMinutes()).padStart(2, "0")}:00`;
globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({
    dayList: { 0: { orgdate: key(checkin), tsecs: 8 * 3600 } },
    entries: { [key(now)]: [{ fdate }] },
  }),
});

await import("../../src/worker/background.ts");
const send = () =>
  new Promise((r) => listeners.message({ action: "updateAttendance" }, {}, r));

// ---- 7. a target already in the past must not be armed (it would fire instantly,
//         then again on every 15-minute refresh for the rest of the day)
await send();
const armed = calls.alarmsCreated.filter((a) => a.name.startsWith("gate:"));
assert.deepStrictEqual(
  armed.map((a) => a.name),
  ["gate:fullTime"],
  "only the future gate should arm, got " +
    JSON.stringify(armed.map((a) => a.name)),
);
console.log(
  "7 OK  past part-time gate not armed; only",
  armed[0].name,
  `@+${Math.round((armed[0].when - Date.now()) / 60000)}m`,
);

// ---- 8. yesterday's fired state must not suppress today's gates
store.set("gateState", { date: "2000-01-01", fired: ["partTime", "fullTime"] });
calls.alarmsCreated.length = 0;
await send();
assert.strictEqual(
  store.get("gateState").date,
  key(now),
  "gateState should roll over to today",
);
assert.deepStrictEqual(
  store.get("gateState").fired,
  [],
  "stale fired list must be dropped",
);
assert.ok(
  calls.alarmsCreated.some((a) => a.name === "gate:fullTime"),
  "today's gate must still arm",
);
console.log(
  "8 OK  gateState rolled over to",
  store.get("gateState").date,
  "with fired=[]",
);

console.log("\nAll edge-case assertions passed.");
