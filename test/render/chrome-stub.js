// Minimal `chrome` global, injected before the popup's module script so the
// popup renders from fixture data instead of a live Zoho session. Values are
// chosen to light up every calendar cell state at once: full days, short days,
// a sub-6h day, leave, absence, a holiday, weekends, attendance requests, and
// today - because the invariant this harness checks is that none of them move
// the date glyph.
const key = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const now = new Date();
const dayList = {};
const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const last = new Date(now.getFullYear(), now.getMonth(), now.getDate());
let index = 0;
for (const cursor = new Date(first); cursor <= last; cursor.setDate(cursor.getDate() + 1)) {
  const weekend = cursor.getDay() === 0 || cursor.getDay() === 6;
  const shape = index % 7;
  let day = { orgdate: key(cursor), tsecs: 8.4 * 3600, status: "Present" };
  if (weekend) day = { orgdate: key(cursor), tsecs: 0, status: "Weekend" };
  else if (shape === 1) day = { orgdate: key(cursor), tsecs: 6.5 * 3600, status: "Present" };
  else if (shape === 2) day = { orgdate: key(cursor), tsecs: 4.2 * 3600, status: "Present" };
  else if (shape === 3) day = { orgdate: key(cursor), tsecs: 0, status: "Present", leaveDaysTaken: 1 };
  else if (shape === 4) day = { orgdate: key(cursor), tsecs: 0, status: "Absent" };
  else if (shape === 5) day = { orgdate: key(cursor), tsecs: 0, status: "Public Holiday" };
  if (shape === 6) day.approvalInfo = [{ id: index, reason: "Forgot to check out" }];
  dayList[key(cursor)] = day;
  index++;
}

const checkin = new Date(now.getTime() - 3 * 3600 * 1000);
const stamp = (date) => {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${String(date.getDate()).padStart(2, "0")}-${months[date.getMonth()]}-${date.getFullYear()} - ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const STORE = {
  csrfToken: "fixture",
  theme: "__THEME__",
  lang: "__LANG__",
  scheme: "gruvbox",
  activeTab: "calendar",
  lastSuccessAt: Date.now() - 2 * 60 * 1000,
  lastError: null,
  archivedMonths: {},
  attendanceData: { dayList, entries: { [key(now)]: [{ fdate: stamp(checkin), tdate: "-" }] } },
};

globalThis.chrome = {
  storage: {
    local: {
      get: async (keys) =>
        Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map((name) => [name, STORE[name]])),
      set: () => {},
    },
    onChanged: { addListener: () => {} },
  },
  runtime: { sendMessage: async () => ({ status: "success" }), openOptionsPage: () => {} },
};

// The measurement: every date must occupy an identical box and sit at an
// identical offset inside it. Measuring the box alone has missed two real
// bugs, so the glyph is measured with a Range.
setTimeout(() => {
  const cells = [...document.querySelectorAll(".cal-cell:not(.spacer)")];
  const geometries = new Set();
  const offsets = new Set();
  for (const cell of cells) {
    const box = cell.getBoundingClientRect();
    geometries.add(`${box.width.toFixed(2)}x${box.height.toFixed(2)}`);
    const range = document.createRange();
    range.selectNodeContents(cell.firstChild);
    const glyph = range.getBoundingClientRect();
    offsets.add(`${(glyph.top - box.top).toFixed(2)}/${glyph.height.toFixed(2)}`);
  }
  document.title = JSON.stringify({
    cells: cells.length,
    geometries: [...geometries],
    offsets: [...offsets],
    bodyHeight: Math.round(document.body.getBoundingClientRect().height),
  });
}, 700);
