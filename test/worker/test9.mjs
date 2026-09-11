import assert from "node:assert";
const store = new Map();
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
    setBadgeBackgroundColor: async () => {},
    setTitle: async () => {},
  },
  notifications: {
    create: () => {},
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
const key = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = key(new Date());
globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({
    dayList: { 0: { orgdate: today, tsecs: 4 * 3600 } },
    entries: {
      [today]: [
        { fdate: "10-Sep-2026 - 09:29", tdate: "10-Sep-2026 - 11:53" },
        { fdate: "10-Sep-2026 - 01:00 PM", tdate: "-" },
        { fdate: "mystery-format", tdate: "mystery-format" },
      ],
    },
  }),
});
await import("../../src/worker/background.js");
await new Promise((r) => listeners.m({ action: "updateAttendance" }, {}, r));
const cached = store.get("attendanceData").entries[today];
assert.strictEqual(
  cached[0].fdate,
  "2026-09-10 09:29:00",
  "DMY normalised to ISO at ingest",
);
assert.strictEqual(cached[0].tdate, "2026-09-10 11:53:00");
assert.strictEqual(
  cached[1].fdate,
  "2026-09-10 13:00:00",
  "12-hour PM normalised",
);
assert.strictEqual(cached[1].tdate, "-", "open-session placeholder preserved");
assert.strictEqual(
  cached[2].fdate,
  "mystery-format",
  "unrecognised value kept verbatim, not destroyed",
);
console.log(
  "OK  ingest normalisation: DMY->ISO, PM->24h, '-' kept, unknown kept verbatim",
);
console.log("    cached day:", JSON.stringify(cached));
