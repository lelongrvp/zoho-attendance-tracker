import {
  computeEffectiveTargets,
  findActiveCheckin,
  isPastLateThreshold,
  isPlaceholderTime,
  isUsablePayload,
  monthKey,
  pad,
  parseZohoTimestamp,
  readPolicy,
  readPortalId,
  toLocalDateKey,
} from "../lib/policy.js";
import { makeTranslator, normalizeLanguage } from "../lib/i18n.js";
import { badgeColors } from "../lib/themes.js";

const REFRESH_ALARM = "refreshAttendance";
const REFRESH_PERIOD_MINUTES = 15;
const GATE_ALARMS = { partTime: "gate:partTime", fullTime: "gate:fullTime" };
const GATE_NAME_KEYS = { partTime: "gateNamePart", fullTime: "gateNameFull" };

async function readTranslator() {
  const { lang } = await chrome.storage.local.get("lang");
  return makeTranslator(normalizeLanguage(lang));
}

// Zoho's session cookies are attached automatically by the browser because of
// the host permission; only the CSRF token has to be forwarded in the body.
async function syncCsrfToken() {
  const cookies = await chrome.cookies.getAll({ domain: "people.zoho.com" });
  const csrfCookie = cookies.find((cookie) => cookie.name === "CSRF_TOKEN");

  if (!csrfCookie) {
    await chrome.storage.local.remove("csrfToken");
    return null;
  }

  await chrome.storage.local.set({ csrfToken: csrfCookie.value });
  return csrfCookie.value;
}

async function fetchMonth(url, csrfToken, monthsAgo) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: new URLSearchParams({
      mode: "getAttList",
      conreqcsr: csrfToken,
      loadToday: "false",
      view: "month",
      preMonth: String(monthsAgo),
    }),
  });

  if (!response.ok) {
    throw new Error(`Zoho returned HTTP ${response.status}`);
  }

  // An expired session answers with an HTML login page, not JSON.
  return response.json().catch(() => {
    throw new Error(
      "Zoho returned a non-JSON response — the session has probably expired",
    );
  });
}

function toIsoTimestamp(date) {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

// Entry timestamps arrive in the org's locale format ("10-Sep-2026 - 09:29");
// canonicalising them to ISO once per refresh means the popup — which
// re-parses the cache every timer tick — only ever sees the fast path, and a
// format Zoho changes under us surfaces here, once, as a counted warning
// instead of a console flood. Unparseable values are kept verbatim so nothing
// is destroyed, and the placeholder "-" of an open session passes through.
function normalizeEntries(entries) {
  const normalized = {};
  const unrecognised = new Set();

  for (const [dateKey, dayEntries] of Object.entries(entries || {})) {
    normalized[dateKey] = (dayEntries || []).map((entry) => {
      const result = { ...entry };
      for (const field of ["fdate", "tdate"]) {
        if (!(field in result) || isPlaceholderTime(result[field])) {
          continue;
        }
        const parsed = parseZohoTimestamp(result[field]);
        if (parsed) {
          result[field] = toIsoTimestamp(parsed);
        } else {
          unrecognised.add(String(result[field]));
        }
      }
      return result;
    });
  }

  if (unrecognised.size > 0) {
    console.warn(
      `[attendance] ${unrecognised.size} unrecognised timestamp value(s) left verbatim:`,
      [...unrecognised].slice(0, 5).join(" | "),
    );
  }
  return normalized;
}

// The popup needs a rolling window that spans the payroll cycle, so the
// previous month is merged in ahead of the current one. Keying by orgdate
// drops the days the two responses report twice.
function mergeMonths(previousMonth, currentMonth) {
  const dayByDate = new Map();

  for (const day of Object.values(previousMonth.dayList || {})) {
    dayByDate.set(day.orgdate, day);
  }
  for (const day of Object.values(currentMonth.dayList || {})) {
    dayByDate.set(day.orgdate, day);
  }

  const sortedDays = [...dayByDate.values()].sort((first, second) =>
    String(first.orgdate).localeCompare(String(second.orgdate)),
  );

  const dayList = {};
  sortedDays.forEach((day, index) => {
    dayList[index] = day;
  });

  return {
    ...currentMonth,
    dayList,
    entries: normalizeEntries({
      ...previousMonth.entries,
      ...currentMonth.entries,
    }),
  };
}

async function refreshAttendance() {
  try {
    const csrfToken = await syncCsrfToken();
    if (!csrfToken) {
      throw new Error("Not signed in to Zoho People");
    }

    const portalId = await readPortalId();
    const url = `https://people.zoho.com/${portalId}/AttendanceViewAction.zp`;

    const [previousMonth, currentMonth] = await Promise.all([
      fetchMonth(url, csrfToken, 1),
      fetchMonth(url, csrfToken, 0),
    ]);

    const attendanceData = mergeMonths(previousMonth, currentMonth);
    if (!isUsablePayload(attendanceData)) {
      throw new Error(
        "Zoho returned an unrecognised payload — keeping the last good data",
      );
    }

    await chrome.storage.local.set({
      attendanceData,
      lastSuccessAt: Date.now(),
      lastError: null,
    });

    const policy = await readPolicy();
    await scheduleGates(attendanceData, policy);
    await updateBadge(attendanceData, policy);
  } catch (error) {
    await chrome.storage.local.set({
      lastError: { message: error.message, at: Date.now() },
    });
    throw error;
  }
}

// Months outside the rolling two-month window the rest of the extension runs
// on, fetched only when the calendar is actually navigated back to them and
// kept in their own store: refreshAttendance() replaces attendanceData
// wholesale every 15 minutes, so anything archived alongside it would be
// thrown away twice an hour. Only dayList is kept - the calendar reads tsecs
// and status, and nothing outside the current cycle needs punch entries.
const MAX_ARCHIVE_MONTHS_AGO = 24;

async function fetchArchiveMonth(monthsAgo) {
  if (
    !Number.isInteger(monthsAgo) ||
    monthsAgo < 1 ||
    monthsAgo > MAX_ARCHIVE_MONTHS_AGO
  ) {
    throw new Error(`Refusing to fetch ${monthsAgo} months back`);
  }

  const csrfToken = await syncCsrfToken();
  if (!csrfToken) {
    throw new Error("Not signed in to Zoho People");
  }

  const portalId = await readPortalId();
  const url = `https://people.zoho.com/${portalId}/AttendanceViewAction.zp`;
  const month = await fetchMonth(url, csrfToken, monthsAgo);
  if (!isUsablePayload(month)) {
    throw new Error("Zoho returned no attendance for that month");
  }

  const now = new Date();
  const key = monthKey(
    new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1),
  );

  // `preMonth` is how the endpoint addresses history, and how far back it
  // honours is not documented. Caching whatever came back under the key that
  // was asked for would draw another month's days as if they were this one -
  // the exact class of confident wrong answer this extension refuses
  // everywhere else. So check what arrived before trusting the label.
  const returned = new Set(
    Object.values(month.dayList)
      .map((day) => parseZohoTimestamp(day.orgdate))
      .filter(Boolean)
      .map(monthKey),
  );
  if (!returned.has(key)) {
    throw new Error(
      `Asked Zoho for ${key}, got ${[...returned].join(", ") || "nothing"} — this endpoint may not reach back that far`,
    );
  }
  const { archivedMonths = {} } =
    await chrome.storage.local.get("archivedMonths");
  await chrome.storage.local.set({
    archivedMonths: { ...archivedMonths, [key]: { dayList: month.dayList } },
  });
  return key;
}

// Fire-and-forget callers can't surface a rejection, and the popup reads
// lastError instead, so absorb it here.
async function refreshInBackground() {
  try {
    await refreshAttendance();
  } catch (error) {
    console.warn("[attendance] Refresh failed:", error.message);
  }
}

// ---------------------------------------------------------------- gates

// Re-armed on every refresh, which makes this self-correcting: it picks up a
// check-in that happened after the last poll and survives the worker being
// killed. Same-name create replaces, so repeating it is idempotent.
async function scheduleGates(attendanceData, policy) {
  const now = new Date();
  const todayKey = toLocalDateKey(now);

  await chrome.alarms.clear(GATE_ALARMS.partTime);
  await chrome.alarms.clear(GATE_ALARMS.fullTime);

  const { gateState } = await chrome.storage.local.get("gateState");
  const firedToday = gateState?.date === todayKey ? gateState.fired : [];
  await chrome.storage.local.set({
    gateState: { date: todayKey, fired: firedToday },
  });

  const active = findActiveCheckin(attendanceData, now, policy);
  if (!active) {
    return;
  }

  const targets = computeEffectiveTargets(attendanceData, active, now, policy);
  for (const gate of ["partTime", "fullTime"]) {
    // An alarm whose `when` is past fires immediately, which would mean a
    // fresh ping on every refresh for the rest of the day.
    if (!firedToday.includes(gate) && targets[gate].getTime() > Date.now()) {
      chrome.alarms.create(GATE_ALARMS[gate], {
        when: targets[gate].getTime(),
      });
    }
  }

  // A full-time target past the 19:30 threshold is worth knowing right after
  // check-in, while something can still be done about it — not at 19:30.
  if (
    !firedToday.includes("longDay") &&
    targets.fullTime.getTime() > Date.now() &&
    isPastLateThreshold(targets.fullTime, active.checkin, policy)
  ) {
    const translate = await readTranslator();
    const targetText = targets.fullTime.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const thresholdText = `${pad(Math.floor(policy.lateThresholdMinutes / 60))}:${pad(policy.lateThresholdMinutes % 60)}`;
    chrome.notifications.create(`longDay:${todayKey}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icon128.png"),
      title: translate("notifLongDayTitle"),
      message: translate("notifLongDayMsg", {
        t: targetText,
        th: thresholdText,
      }),
    });
    await chrome.storage.local.set({
      gateState: { date: todayKey, fired: [...firedToday, "longDay"] },
    });
  }
}

// Language-neutral compact duration, embedded into localized sentences.
function formatAgo(minutes) {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${pad(rest)}m`;
}

// Chrome fires an alarm missed during sleep once, on wake — so it can arrive
// badly late. The body always names the real target time and how stale it is
// rather than implying "now", which would sometimes be an hour wrong.
async function fireGate(gate) {
  const policy = await readPolicy();
  const { attendanceData, gateState } = await chrome.storage.local.get([
    "attendanceData",
    "gateState",
  ]);

  const now = new Date();
  const todayKey = toLocalDateKey(now);
  // A gate alarm only exists because a real target armed it, so an elapsed
  // session still counts here — the alarm fires at or after the target, and a
  // snoozed one can land on the far side of midnight.
  const active = findActiveCheckin(attendanceData || {}, now, policy, {
    allowElapsed: true,
  });
  if (!active) {
    return;
  }

  const translate = await readTranslator();
  const target = computeEffectiveTargets(
    attendanceData || {},
    active,
    now,
    policy,
  )[gate];
  const lateMinutes = Math.round((Date.now() - target.getTime()) / 60000);
  const targetText = target.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const gateName = translate(GATE_NAME_KEYS[gate]);
  const message =
    lateMinutes >= 2
      ? translate("notifTargetWas", {
          gate: gateName,
          t: targetText,
          ago: formatAgo(lateMinutes),
        })
      : translate("notifTargetReached", { gate: gateName, t: targetText });

  chrome.notifications.create(`${gate}:${todayKey}`, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icon128.png"),
    title: translate(gate === "fullTime" ? "notifFullTitle" : "notifPartTitle"),
    message,
    buttons: [{ title: translate("snooze") }],
    requireInteraction: true,
  });

  const firedToday = gateState?.date === todayKey ? gateState.fired : [];
  await chrome.storage.local.set({
    gateState: { date: todayKey, fired: [...new Set([...firedToday, gate])] },
  });
  await updateBadge(attendanceData, policy);
}

chrome.notifications.onButtonClicked.addListener((notificationId) => {
  const [gate] = notificationId.split(":");
  if (!GATE_ALARMS[gate]) {
    return;
  }
  chrome.notifications.clear(notificationId);
  chrome.alarms.create(GATE_ALARMS[gate], {
    when: Date.now() + 15 * 60 * 1000,
  });
});

// ---------------------------------------------------------------- badge

// Visible without opening anything, and free — setBadgeText needs no permission.
// The title doubles as a hover tooltip carrying the actual target time.
async function updateBadge(attendanceData, policy) {
  const data =
    attendanceData ??
    (await chrome.storage.local.get("attendanceData")).attendanceData;
  const activePolicy = policy ?? (await readPolicy());
  const active = findActiveCheckin(data || {}, new Date(), activePolicy);
  const translate = await readTranslator();
  const { scheme, customScheme } = await chrome.storage.local.get([
    "scheme",
    "customScheme",
  ]);
  const colors = badgeColors(scheme || "gruvbox", customScheme);

  if (!active) {
    await chrome.action.setBadgeText({ text: "" });
    await chrome.action.setTitle({ title: translate("badgeNoCheckin") });
    return;
  }

  const target = computeEffectiveTargets(
    data || {},
    active,
    new Date(),
    activePolicy,
  ).fullTime;
  const targetText = target.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const remainingMs = target.getTime() - Date.now();

  if (remainingMs <= 0) {
    await chrome.action.setBadgeText({ text: "OK" });
    await chrome.action.setBadgeBackgroundColor({ color: colors.ok });
    await chrome.action.setTitle({
      title: translate("badgeComplete", { t: targetText }),
    });
    return;
  }

  const minutes = Math.ceil(remainingMs / 60000);
  const isLate = isPastLateThreshold(target, active.checkin, activePolicy);
  await chrome.action.setBadgeText({
    text: minutes >= 60 ? `${Math.floor(minutes / 60)}h` : `${minutes}m`,
  });
  await chrome.action.setBadgeBackgroundColor({
    color: isLate ? colors.late : colors.neutral,
  });
  await chrome.action.setTitle({
    title: translate("badgeFullAt", { t: targetText }),
  });
}

// ---------------------------------------------------------------- wiring

// Guarded so it self-heals if the alarm is ever lost, but never recreated
// unconditionally: that would reset the period on every worker wake and the
// periodic refresh could end up never firing.
async function ensureRefreshAlarm() {
  const existing = await chrome.alarms.get(REFRESH_ALARM);
  if (!existing) {
    chrome.alarms.create(REFRESH_ALARM, {
      periodInMinutes: REFRESH_PERIOD_MINUTES,
    });
  }
}

ensureRefreshAlarm();

chrome.runtime.onInstalled.addListener(() => {
  ensureRefreshAlarm();
  refreshInBackground();
});

chrome.runtime.onStartup.addListener(() => {
  ensureRefreshAlarm();
  refreshInBackground();
});

// The service worker is torn down when idle, so alarms are what keep the
// cached data current and the gates armed between popup openings.
// Returning the promise keeps the worker alive for the handler's async work
// rather than letting it be torn down mid-flight.
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) {
    return refreshInBackground();
  }
  const gate = Object.keys(GATE_ALARMS).find(
    (name) => GATE_ALARMS[name] === alarm.name,
  );
  if (gate) {
    return fireGate(gate);
  }
});

chrome.cookies.onChanged.addListener(async (changeInfo) => {
  const { cookie, removed } = changeInfo;
  if (
    !cookie.domain.includes("people.zoho.com") ||
    cookie.name !== "CSRF_TOKEN"
  ) {
    return;
  }

  if (removed) {
    await chrome.storage.local.remove("csrfToken");
    return;
  }

  await chrome.storage.local.set({ csrfToken: cookie.value });
  refreshInBackground();
});

// Re-arm gates and redraw the badge when the policy changes from the options
// page; the attendance data itself has not changed, so no network refetch.
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local") {
    return;
  }
  if (
    (changes.scheme || changes.customScheme || changes.lang) &&
    !changes.policy
  ) {
    await updateBadge();
    return;
  }
  if (!changes.policy) {
    return;
  }
  const { attendanceData } = await chrome.storage.local.get("attendanceData");
  if (!attendanceData) {
    return;
  }
  const policy = await readPolicy();
  await scheduleGates(attendanceData, policy);
  await updateBadge(attendanceData, policy);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const work =
    request.action === "updateAttendance"
      ? refreshAttendance()
      : request.action === "fetchArchiveMonth"
        ? fetchArchiveMonth(request.monthsAgo)
        : null;

  if (!work) {
    return false;
  }

  work
    .then((result) => sendResponse({ status: "success", result }))
    .catch((error) =>
      sendResponse({ status: "error", message: error.message }),
    );

  return true;
});
