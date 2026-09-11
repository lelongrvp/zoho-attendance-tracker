import assert from "node:assert";

const store = new Map();
const calls = { alarmsCreated: [], alarmsCleared: [], notifications: [], badge: [] };
const listeners = {};
const reg = (name) => ({ addListener: (fn) => { listeners[name] = fn; } });

globalThis.chrome = {
  storage: { local: {
    get: async (keys) => {
      const list = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(list.map((k) => [k, store.get(k)]));
    },
    set: async (obj) => { for (const [k, v] of Object.entries(obj)) store.set(k, v); },
    remove: async (k) => { store.delete(k); },
  }, onChanged: reg("storageChanged") },
  cookies: { getAll: async () => [{ name: "CSRF_TOKEN", value: "tok", domain: "people.zoho.com" }],
             onChanged: reg("cookieChanged") },
  alarms: {
    create: (name, info) => calls.alarmsCreated.push({ name, ...info }),
    clear: async (name) => { calls.alarmsCleared.push(name); },
    get: async () => undefined,
    onAlarm: reg("alarm"),
  },
  action: {
    setBadgeText: async (o) => calls.badge.push(o.text),
    setBadgeBackgroundColor: async () => {},
    setTitle: async () => {},
  },
  notifications: { create: (id, opts) => calls.notifications.push({ id, ...opts }),
                   clear: () => {}, onButtonClicked: reg("notifButton") },
  runtime: { onInstalled: reg("installed"), onStartup: reg("startup"), onMessage: reg("message"),
             getURL: (p) => `chrome-extension://x/${p}` },
};

// Check-in 3h ago -> part-time target is ~4.25h out, full-time ~6.25h out.
const now = new Date();
const key = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const checkin = new Date(now.getTime() - 3 * 3600 * 1000);
const fdate = `${key(checkin)} ${String(checkin.getHours()).padStart(2,"0")}:${String(checkin.getMinutes()).padStart(2,"0")}:00`;
const month = (extra) => ({
  dayList: { 0: { orgdate: key(checkin), tsecs: 3 * 3600 }, ...extra },
  entries: { [key(now)]: [{ fdate }] },
});
globalThis.fetch = async () => ({ ok: true, json: async () => month({}) });

await import("../../background.js");

const send = () => new Promise((resolve) => {
  listeners.message({ action: "updateAttendance" }, {}, resolve);
});

// ---- 1. a successful refresh arms both gates and stamps freshness
let res = await send();
assert.strictEqual(res.status, "success", "refresh should succeed");
assert.ok(store.get("lastSuccessAt"), "lastSuccessAt must be recorded");
assert.strictEqual(store.get("lastError"), null, "lastError must be cleared on success");
const armed = calls.alarmsCreated.filter((a) => a.name.startsWith("gate:"));
assert.strictEqual(armed.length, 2, "both gates armed, got " + JSON.stringify(armed));
for (const a of armed) assert.ok(a.when > Date.now(), `${a.name} must be scheduled in the future`);
console.log("1 OK  both gates armed:", armed.map((a) => `${a.name}@+${Math.round((a.when-Date.now())/60000)}m`).join(" "));
console.log("      badge:", calls.badge.at(-1));

// ---- 2. firing a gate notifies once and records it
calls.alarmsCreated.length = 0;
await listeners.alarm({ name: "gate:partTime" });
// depending on wall-clock run time the fixture can also trip the long-day
// heads-up, so count only gate notifications here
const gateNotes = calls.notifications.filter((n) => !n.id.startsWith("longDay:"));
assert.strictEqual(gateNotes.length, 1, "one gate notification");
const note = gateNotes[0];
assert.match(note.message, /Part-time target/, "message names the gate");
assert.ok(note.requireInteraction, "must persist while the user is away");
assert.ok(note.iconUrl.endsWith("icon128.png"), "needs the 128px icon");
assert.ok(store.get("gateState").fired.includes("partTime"), "fired gate recorded in storage");
console.log("2 OK  notification:", JSON.stringify(note.message));

// ---- 3. a later refresh must NOT re-arm an already-fired gate
await send();
const rearmed = calls.alarmsCreated.filter((a) => a.name === "gate:partTime");
assert.strictEqual(rearmed.length, 0, "fired gate must not be re-armed");
const stillArmed = calls.alarmsCreated.filter((a) => a.name === "gate:fullTime");
assert.strictEqual(stillArmed.length, 1, "unfired gate stays armed");
console.log("3 OK  fired gate not re-armed; fullTime still armed");

// ---- 4. a degenerate payload must not overwrite good data
const good = store.get("attendanceData");
globalThis.fetch = async () => ({ ok: true, json: async () => ({ dayList: {}, entries: {} }) });
res = await send();
assert.strictEqual(res.status, "error", "degenerate payload should be rejected");
assert.strictEqual(store.get("attendanceData"), good, "cache must be preserved");
assert.ok(store.get("lastError").at >= store.get("lastSuccessAt"), "lastError newer than lastSuccess");
console.log("4 OK  rejected:", JSON.stringify(res.message));

// ---- 5. an HTML login page (non-JSON) is reported as a session problem
globalThis.fetch = async () => ({ ok: true, json: async () => { throw new SyntaxError("Unexpected token <"); } });
res = await send();
assert.strictEqual(res.status, "error");
assert.match(res.message, /session/i, "should name the session, got " + res.message);
console.log("5 OK  non-JSON:", JSON.stringify(res.message));

// ---- 6. an expired cookie surfaces as a sign-in error
globalThis.chrome.cookies.getAll = async () => [];
res = await send();
assert.match(res.message, /Not signed in/, res.message);
console.log("6 OK  no cookie:", JSON.stringify(res.message));

console.log("\nAll worker assertions passed.");
