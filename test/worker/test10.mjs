import assert from "node:assert";

const STORE = { attendanceData: { dayList: { 0: { orgdate: "2026-09-01", tsecs: 100 } } } };
const fetched = [];
let messageListener = null;

globalThis.chrome = {
  storage: {
    local: {
      get: async (keys) => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map((k) => [k, STORE[k]])),
      set: async (obj) => Object.assign(STORE, obj),
      remove: async () => {},
    },
    onChanged: { addListener: () => {} },
  },
  alarms: { get: async () => null, create: () => {}, clear: async () => {}, onAlarm: { addListener: () => {} } },
  cookies: {
    getAll: async () => [{ name: "CSRF_TOKEN", value: "csrf-token" }],
    get: async () => ({ value: "csrf-token" }),
    onChanged: { addListener: () => {} },
  },
  notifications: { create: () => {}, onClicked: { addListener: () => {} }, onButtonClicked: { addListener: () => {} } },
  action: { setBadgeText: () => {}, setBadgeBackgroundColor: () => {}, setTitle: () => {} },
  runtime: {
    onMessage: { addListener: (fn) => { messageListener = fn; } },
    onInstalled: { addListener: () => {} },
    onStartup: { addListener: () => {} },
  },
};

const monthPayload = (label) => ({
  dayList: { 0: { orgdate: label + "-05", tsecs: 8 * 3600, status: "Present" } },
  entries: { [label + "-05"]: [{ fdate: "05-Jul-2026 - 09:00", tdate: "05-Jul-2026 - 17:00" }] },
});
const monthLabel = (monthsAgo) => {
  const target = new Date(new Date().getFullYear(), new Date().getMonth() - monthsAgo, 1);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
};

globalThis.fetch = async (url, init) => {
  const preMonth = new URLSearchParams(init.body).get("preMonth");
  fetched.push(preMonth);
  return { ok: true, json: async () => monthPayload(monthLabel(Number(preMonth))) };
};

await import("../../src/worker/background.js");
assert.ok(messageListener, "worker must register a message listener");

const send = (request) =>
  new Promise((resolve) => {
    const returned = messageListener(request, {}, resolve);
    assert.strictEqual(returned, true, "async handlers must return true to keep the channel open");
  });

let response = await send({ action: "fetchArchiveMonth", monthsAgo: 2 });
assert.strictEqual(response.status, "success", response.message);
assert.strictEqual(fetched.at(-1), "2", "preMonth must carry the requested distance");
const now = new Date();
const expectedKey = new Date(now.getFullYear(), now.getMonth() - 2, 1);
const key = `${expectedKey.getFullYear()}-${String(expectedKey.getMonth() + 1).padStart(2, "0")}`;
assert.ok(STORE.archivedMonths[key], `archive must be keyed by calendar month, got ${Object.keys(STORE.archivedMonths)}`);
assert.strictEqual(STORE.archivedMonths[key].entries, undefined, "only dayList is archived");
console.log("1 OK  archive fetch stores dayList under", key);

assert.deepStrictEqual(
  STORE.attendanceData.dayList[0],
  { orgdate: "2026-09-01", tsecs: 100 },
  "archiving must not touch the rolling window the badge and gates read",
);
console.log("2 OK  rolling attendanceData untouched");

for (const bad of [0, -1, 25, 1.5, "3", undefined]) {
  response = await send({ action: "fetchArchiveMonth", monthsAgo: bad });
  assert.strictEqual(response.status, "error", `monthsAgo ${bad} must be refused`);
}
console.log("3 OK  out-of-range and non-integer distances refused");

const before = fetched.length;
assert.strictEqual(messageListener({ action: "somethingElse" }, {}, () => {}), false);
assert.strictEqual(fetched.length, before, "unknown actions must not reach the network");
console.log("4 OK  unknown action ignored without fetching");

globalThis.fetch = async () => ({ ok: true, json: async () => ({ dayList: {} }) });
response = await send({ action: "fetchArchiveMonth", monthsAgo: 3 });
assert.strictEqual(response.status, "error", "an unusable payload must not be cached");
const stale = new Date(now.getFullYear(), now.getMonth() - 3, 1);
assert.ok(!STORE.archivedMonths[`${stale.getFullYear()}-${String(stale.getMonth() + 1).padStart(2, "0")}`]);
console.log("5 OK  unusable month rejected, nothing cached");

globalThis.fetch = async (url, init) => {
  const preMonth = new URLSearchParams(init.body).get("preMonth");
  fetched.push(preMonth);
  return { ok: true, json: async () => monthPayload(monthLabel(Number(preMonth))) };
};
response = await send({ action: "updateAttendance" });
assert.strictEqual(response.status, "success", response.message);
assert.deepStrictEqual(fetched.slice(-2).sort(), ["0", "1"], "a refresh still fetches this month and last");
console.log("6 OK  ordinary refresh still routes through the same listener");

globalThis.fetch = async (url, init) => {
  fetched.push(new URLSearchParams(init.body).get("preMonth"));
  return { ok: true, json: async () => monthPayload(monthLabel(0)) };
};
response = await send({ action: "fetchArchiveMonth", monthsAgo: 5 });
assert.strictEqual(response.status, "error", "a different month must not be cached under the asked-for key");
assert.match(response.message, /may not reach back that far/);
const wrong = new Date(now.getFullYear(), now.getMonth() - 5, 1);
assert.ok(!STORE.archivedMonths[`${wrong.getFullYear()}-${String(wrong.getMonth() + 1).padStart(2, "0")}`]);
console.log("7 OK  wrong month refused:", response.message);

console.log("\nAll archive-fetch assertions passed.");
