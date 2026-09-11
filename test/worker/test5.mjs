import assert from "node:assert";

let fakeNow = new Date(2026, 8, 11, 15, 0, 0).getTime();
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
store.set("policy", { targetMode: "worked" });
const calls = { alarmsCreated: [], badge: [], titles: [] };
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
    setBadgeBackgroundColor: async () => {},
    setTitle: async (o) => calls.titles.push(o.title),
  },
  notifications: {
    create: () => {},
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

// 09:00-12:00 closed + open since 13:00 -> 5h worked at 15:00 -> full day 18:00
globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({
    dayList: { 0: { orgdate: "2026-09-11", tsecs: 5 * 3600 } },
    entries: {
      "2026-09-11": [
        { fdate: "2026-09-11 09:00:00", tdate: "2026-09-11 12:00:00" },
        { fdate: "2026-09-11 13:00:00" },
      ],
    },
  }),
});

await import("../../src/worker/background.js");
const send = () =>
  new Promise((r) => listeners.message({ action: "updateAttendance" }, {}, r));

const res = await send();
assert.strictEqual(res.status, "success");
const fullGate = calls.alarmsCreated.find((a) => a.name === "gate:fullTime");
const partGate = calls.alarmsCreated.find((a) => a.name === "gate:partTime");
assert.strictEqual(
  new FakeDate(fullGate.when).getHours(),
  18,
  "worked mode: gate at 18:00, not offset 18:15",
);
assert.strictEqual(new FakeDate(fullGate.when).getMinutes(), 0);
assert.strictEqual(
  new FakeDate(partGate.when).getHours(),
  16,
  "part gate at 16:00 (6h of work)",
);
assert.strictEqual(
  calls.badge.at(-1),
  "3h",
  "badge counts down worked remainder",
);
assert.match(
  calls.titles.at(-1),
  /06:00/i,
  "badge tooltip names the worked target",
);
console.log(
  "OK  worked mode reaches gates and badge: full 18:00, part 16:00, badge 3h",
);
console.log("\nWorked-mode seam verified.");
