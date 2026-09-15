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
store.set("lang", "vi");
store.set("scheme", "nord");
const calls = { notifications: [], badgeColor: [], titles: [] };
const listeners = {};
const reg = (n) => ({
  addListener: (fn) => {
    listeners[n] = fn;
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
    onChanged: reg("sc"),
  },
  cookies: {
    getAll: async () => [
      { name: "CSRF_TOKEN", value: "t", domain: "people.zoho.com" },
    ],
    onChanged: reg("c"),
  },
  alarms: {
    create: () => {},
    clear: async () => {},
    get: async () => undefined,
    onAlarm: reg("alarm"),
  },
  action: {
    setBadgeText: async () => {},
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
    onMessage: reg("m"),
    getURL: (p) => p,
  },
};
// live-format entries: closed pair + open "-", check-in 09:29
globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({
    dayList: { 0: { orgdate: "2026-09-11", tsecs: 4 * 3600 } },
    entries: {
      "2026-09-11": [
        { fdate: "11-Sep-2026 - 09:29", tdate: "11-Sep-2026 - 11:53" },
        { fdate: "11-Sep-2026 - 13:00", tdate: "-" },
      ],
    },
  }),
});
await import("../../src/worker/background.ts");
const send = () =>
  new Promise((r) => listeners.m({ action: "updateAttendance" }, {}, r));
const res = await send();
assert.strictEqual(res.status, "success");
assert.match(calls.titles.at(-1), /Đủ công lúc/, "badge title in Vietnamese");
assert.strictEqual(
  calls.badgeColor.at(-1),
  "#6e737e",
  "nord neutral badge color",
);
fakeNow = new Date(2026, 8, 11, 18, 45, 0).getTime();
await listeners.alarm({ name: "gate:partTime" });
const note = calls.notifications.at(-1);
assert.strictEqual(note.title, "Đã đủ nửa công", "VI gate title");
assert.match(note.message, /Nửa công/, "VI gate name in message");
assert.strictEqual(note.buttons[0].title, "Báo lại sau 15p", "VI snooze");
console.log(
  "OK  VI worker:",
  JSON.stringify(note.title),
  "|",
  JSON.stringify(note.message),
);
console.log(
  "OK  badge title:",
  JSON.stringify(calls.titles.at(-1)),
  "color:",
  calls.badgeColor.at(-1),
);
