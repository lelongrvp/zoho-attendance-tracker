// Relative, not @/: the worker suites import this file directly under node, which ignores tsconfig paths.
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
} from "../lib/policy.ts";
import { makeTranslator, normalizeLanguage } from "../lib/i18n.ts";
import type { Translator } from "../lib/i18n.ts";
import { badgeColors } from "../lib/themes.ts";
import { read, readOne, remove, write } from "../lib/storage.ts";
import type { StorageChanges } from "../lib/storage.ts";
import type {
  ActiveCheckin,
  ArchivedMonth,
  AttendanceData,
  BadgeColors,
  GateState,
  Lang,
  Policy,
  StorageShape,
  Targets,
  ZohoDay,
  ZohoEntry,
} from "../lib/types.ts";

type Gate = "partTime" | "fullTime";

const REFRESH_ALARM: string = "refreshAttendance";
const REFRESH_PERIOD_MINUTES: number = 15;
const GATES: readonly Gate[] = ["partTime", "fullTime"];
const GATE_ALARMS: Record<Gate, string> = {
  partTime: "gate:partTime",
  fullTime: "gate:fullTime",
};
const GATE_NAME_KEYS: Record<Gate, string> = {
  partTime: "gateNamePart",
  fullTime: "gateNameFull",
};

function isGate(value: string | undefined): value is Gate {
  return value === "partTime" || value === "fullTime";
}

async function readTranslator(): Promise<Translator> {
  const lang: Lang | undefined = await readOne("lang");
  return makeTranslator(normalizeLanguage(lang));
}

// Zoho's session cookies are attached automatically by the browser because of
// the host permission; only the CSRF token has to be forwarded in the body.
async function syncCsrfToken(): Promise<string | null> {
  const cookies: chrome.cookies.Cookie[] = await chrome.cookies.getAll({
    domain: "people.zoho.com",
  });
  const csrfCookie: chrome.cookies.Cookie | undefined = cookies.find(
    (cookie: chrome.cookies.Cookie): boolean => cookie.name === "CSRF_TOKEN",
  );

  if (!csrfCookie) {
    await remove("csrfToken");
    return null;
  }

  await write({ csrfToken: csrfCookie.value });
  return csrfCookie.value;
}

async function fetchMonth(
  url: string,
  csrfToken: string,
  monthsAgo: number,
): Promise<AttendanceData> {
  const response: Response = await fetch(url, {
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
  return response.json().catch((): never => {
    throw new Error(
      "Zoho returned a non-JSON response — the session has probably expired",
    );
  });
}

function toIsoTimestamp(date: Date): string {
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
function normalizeEntries(
  entries: Record<string, ZohoEntry[]> | undefined,
): Record<string, ZohoEntry[]> {
  const normalized: Record<string, ZohoEntry[]> = {};
  const unrecognised: Set<string> = new Set();

  for (const [dateKey, dayEntries] of Object.entries(entries ?? {})) {
    normalized[dateKey] = (dayEntries ?? []).map(
      (entry: ZohoEntry): ZohoEntry => {
        const result: ZohoEntry = { ...entry };
        for (const field of ["fdate", "tdate"] as const) {
          if (!(field in result) || isPlaceholderTime(result[field])) {
            continue;
          }
          const parsed: Date | null = parseZohoTimestamp(result[field]);
          if (parsed) {
            result[field] = toIsoTimestamp(parsed);
          } else {
            unrecognised.add(String(result[field]));
          }
        }
        return result;
      },
    );
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
function mergeMonths(
  previousMonth: AttendanceData,
  currentMonth: AttendanceData,
): AttendanceData {
  const dayByDate: Map<string, ZohoDay> = new Map();

  for (const day of Object.values(previousMonth.dayList ?? {})) {
    dayByDate.set(day.orgdate, day);
  }
  for (const day of Object.values(currentMonth.dayList ?? {})) {
    dayByDate.set(day.orgdate, day);
  }

  const sortedDays: ZohoDay[] = [...dayByDate.values()].sort(
    (first: ZohoDay, second: ZohoDay): number =>
      String(first.orgdate).localeCompare(String(second.orgdate)),
  );

  const dayList: Record<string, ZohoDay> = {};
  sortedDays.forEach((day: ZohoDay, index: number): void => {
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

async function refreshAttendance(): Promise<void> {
  try {
    const csrfToken: string | null = await syncCsrfToken();
    if (!csrfToken) {
      throw new Error("Not signed in to Zoho People");
    }

    const portalId: string = await readPortalId();
    const url: string = `https://people.zoho.com/${portalId}/AttendanceViewAction.zp`;

    const [previousMonth, currentMonth]: [AttendanceData, AttendanceData] =
      await Promise.all([
        fetchMonth(url, csrfToken, 1),
        fetchMonth(url, csrfToken, 0),
      ]);

    const attendanceData: AttendanceData = mergeMonths(
      previousMonth,
      currentMonth,
    );
    if (!isUsablePayload(attendanceData)) {
      throw new Error(
        "Zoho returned an unrecognised payload — keeping the last good data",
      );
    }

    await write({
      attendanceData,
      lastSuccessAt: Date.now(),
      lastError: null,
    });

    const policy: Policy = await readPolicy();
    await scheduleGates(attendanceData, policy);
    await updateBadge(attendanceData, policy);
  } catch (error) {
    await write({
      lastError: { message: (error as Error).message, at: Date.now() },
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
const MAX_ARCHIVE_MONTHS_AGO: number = 24;

async function fetchArchiveMonth(monthsAgo: number): Promise<string> {
  if (
    !Number.isInteger(monthsAgo) ||
    monthsAgo < 1 ||
    monthsAgo > MAX_ARCHIVE_MONTHS_AGO
  ) {
    throw new Error(`Refusing to fetch ${monthsAgo} months back`);
  }

  const csrfToken: string | null = await syncCsrfToken();
  if (!csrfToken) {
    throw new Error("Not signed in to Zoho People");
  }

  const portalId: string = await readPortalId();
  const url: string = `https://people.zoho.com/${portalId}/AttendanceViewAction.zp`;
  const month: AttendanceData = await fetchMonth(url, csrfToken, monthsAgo);
  if (!isUsablePayload(month)) {
    throw new Error("Zoho returned no attendance for that month");
  }

  const now: Date = new Date();
  const key: string = monthKey(
    new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1),
  );

  // `preMonth` is how the endpoint addresses history, and how far back it
  // honours is not documented. Caching whatever came back under the key that
  // was asked for would draw another month's days as if they were this one -
  // the exact class of confident wrong answer this extension refuses
  // everywhere else. So check what arrived before trusting the label.
  const returned: Set<string> = new Set(
    Object.values(month.dayList)
      .map((day: ZohoDay): Date | null => parseZohoTimestamp(day.orgdate))
      .filter((date: Date | null): date is Date => date !== null)
      .map(monthKey),
  );
  if (!returned.has(key)) {
    throw new Error(
      `Asked Zoho for ${key}, got ${[...returned].join(", ") || "nothing"} — this endpoint may not reach back that far`,
    );
  }
  const archivedMonths: Record<string, ArchivedMonth> =
    (await readOne("archivedMonths")) ?? {};
  await write({
    archivedMonths: { ...archivedMonths, [key]: { dayList: month.dayList } },
  });
  return key;
}

// Fire-and-forget callers can't surface a rejection, and the popup reads
// lastError instead, so absorb it here.
async function refreshInBackground(): Promise<void> {
  try {
    await refreshAttendance();
  } catch (error) {
    console.warn("[attendance] Refresh failed:", (error as Error).message);
  }
}

// ---------------------------------------------------------------- gates

// Re-armed on every refresh, which makes this self-correcting: it picks up a
// check-in that happened after the last poll and survives the worker being
// killed. Same-name create replaces, so repeating it is idempotent.
async function scheduleGates(
  attendanceData: AttendanceData,
  policy: Policy,
): Promise<void> {
  const now: Date = new Date();
  const todayKey: string = toLocalDateKey(now);

  await chrome.alarms.clear(GATE_ALARMS.partTime);
  await chrome.alarms.clear(GATE_ALARMS.fullTime);

  const gateState: GateState | undefined = await readOne("gateState");
  const firedToday: string[] =
    gateState?.date === todayKey ? gateState.fired : [];
  await write({ gateState: { date: todayKey, fired: firedToday } });

  const active: ActiveCheckin | null = findActiveCheckin(
    attendanceData,
    now,
    policy,
  );
  if (!active) {
    return;
  }

  const targets: Targets = computeEffectiveTargets(
    attendanceData,
    active,
    now,
    policy,
  );
  for (const gate of GATES) {
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
    const translate: Translator = await readTranslator();
    const targetText: string = targets.fullTime.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const thresholdText: string = `${pad(Math.floor(policy.lateThresholdMinutes / 60))}:${pad(policy.lateThresholdMinutes % 60)}`;
    chrome.notifications.create(`longDay:${todayKey}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icon128.png"),
      title: translate("notifLongDayTitle"),
      message: translate("notifLongDayMsg", {
        t: targetText,
        th: thresholdText,
      }),
    });
    await write({
      gateState: { date: todayKey, fired: [...firedToday, "longDay"] },
    });
  }
}

// Language-neutral compact duration, embedded into localized sentences.
function formatAgo(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours: number = Math.floor(minutes / 60);
  const rest: number = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${pad(rest)}m`;
}

// Chrome fires an alarm missed during sleep once, on wake — so it can arrive
// badly late. The body always names the real target time and how stale it is
// rather than implying "now", which would sometimes be an hour wrong.
async function fireGate(gate: Gate): Promise<void> {
  const policy: Policy = await readPolicy();
  const stored: Partial<Pick<StorageShape, "attendanceData" | "gateState">> =
    await read(["attendanceData", "gateState"]);

  const now: Date = new Date();
  const todayKey: string = toLocalDateKey(now);
  // A gate alarm only exists because a real target armed it, so an elapsed
  // session still counts here — the alarm fires at or after the target, and a
  // snoozed one can land on the far side of midnight.
  const active: ActiveCheckin | null = findActiveCheckin(
    stored.attendanceData,
    now,
    policy,
    { allowElapsed: true },
  );
  if (!active) {
    return;
  }

  const translate: Translator = await readTranslator();
  const target: Date = computeEffectiveTargets(
    stored.attendanceData,
    active,
    now,
    policy,
  )[gate];
  const lateMinutes: number = Math.round(
    (Date.now() - target.getTime()) / 60000,
  );
  const targetText: string = target.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const gateName: string = translate(GATE_NAME_KEYS[gate]);
  const message: string =
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

  const firedToday: string[] =
    stored.gateState?.date === todayKey ? stored.gateState.fired : [];
  await write({
    gateState: { date: todayKey, fired: [...new Set([...firedToday, gate])] },
  });
  await updateBadge(stored.attendanceData, policy);
}

chrome.notifications.onButtonClicked.addListener(
  (notificationId: string): void => {
    const gate: string | undefined = notificationId.split(":")[0];
    if (!isGate(gate)) {
      return;
    }
    chrome.notifications.clear(notificationId);
    chrome.alarms.create(GATE_ALARMS[gate], {
      when: Date.now() + 15 * 60 * 1000,
    });
  },
);

// ---------------------------------------------------------------- badge

// Visible without opening anything, and free — setBadgeText needs no permission.
// The title doubles as a hover tooltip carrying the actual target time.
async function updateBadge(
  attendanceData?: AttendanceData,
  policy?: Policy,
): Promise<void> {
  const data: AttendanceData | undefined =
    attendanceData ?? (await readOne("attendanceData"));
  const activePolicy: Policy = policy ?? (await readPolicy());
  const active: ActiveCheckin | null = findActiveCheckin(
    data,
    new Date(),
    activePolicy,
  );
  const translate: Translator = await readTranslator();
  const appearance: Partial<Pick<StorageShape, "scheme" | "customScheme">> =
    await read(["scheme", "customScheme"]);
  const colors: BadgeColors = badgeColors(
    appearance.scheme || "gruvbox",
    appearance.customScheme,
  );

  if (!active) {
    await chrome.action.setBadgeText({ text: "" });
    await chrome.action.setTitle({ title: translate("badgeNoCheckin") });
    return;
  }

  const target: Date = computeEffectiveTargets(
    data,
    active,
    new Date(),
    activePolicy,
  ).fullTime;
  const targetText: string = target.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const remainingMs: number = target.getTime() - Date.now();

  if (remainingMs <= 0) {
    await chrome.action.setBadgeText({ text: "OK" });
    await chrome.action.setBadgeBackgroundColor({ color: colors.ok });
    await chrome.action.setTitle({
      title: translate("badgeComplete", { t: targetText }),
    });
    return;
  }

  const minutes: number = Math.ceil(remainingMs / 60000);
  const isLate: boolean = isPastLateThreshold(
    target,
    active.checkin,
    activePolicy,
  );
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
async function ensureRefreshAlarm(): Promise<void> {
  const existing: chrome.alarms.Alarm | undefined =
    await chrome.alarms.get(REFRESH_ALARM);
  if (!existing) {
    chrome.alarms.create(REFRESH_ALARM, {
      periodInMinutes: REFRESH_PERIOD_MINUTES,
    });
  }
}

void ensureRefreshAlarm();

chrome.runtime.onInstalled.addListener((): void => {
  void ensureRefreshAlarm();
  void refreshInBackground();
});

chrome.runtime.onStartup.addListener((): void => {
  void ensureRefreshAlarm();
  void refreshInBackground();
});

// The service worker is torn down when idle, so alarms are what keep the
// cached data current and the gates armed between popup openings.
// Returning the promise keeps the worker alive for the handler's async work
// rather than letting it be torn down mid-flight.
chrome.alarms.onAlarm.addListener(
  (alarm: chrome.alarms.Alarm): Promise<void> | undefined => {
    if (alarm.name === REFRESH_ALARM) {
      return refreshInBackground();
    }
    const gate: Gate | undefined = GATES.find(
      (name: Gate): boolean => GATE_ALARMS[name] === alarm.name,
    );
    if (gate) {
      return fireGate(gate);
    }
    return undefined;
  },
);

chrome.cookies.onChanged.addListener(
  async (changeInfo: chrome.cookies.CookieChangeInfo): Promise<void> => {
    const { cookie, removed } = changeInfo;
    if (
      !cookie.domain.includes("people.zoho.com") ||
      cookie.name !== "CSRF_TOKEN"
    ) {
      return;
    }

    if (removed) {
      await remove("csrfToken");
      return;
    }

    await write({ csrfToken: cookie.value });
    void refreshInBackground();
  },
);

// Re-arm gates and redraw the badge when the policy changes from the options
// page; the attendance data itself has not changed, so no network refetch.
chrome.storage.onChanged.addListener(
  async (
    rawChanges: { [key: string]: chrome.storage.StorageChange },
    area: string,
  ): Promise<void> => {
    if (area !== "local") {
      return;
    }
    const changes: StorageChanges = rawChanges as StorageChanges;
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
    const attendanceData: AttendanceData | undefined =
      await readOne("attendanceData");
    if (!attendanceData) {
      return;
    }
    const policy: Policy = await readPolicy();
    await scheduleGates(attendanceData, policy);
    await updateBadge(attendanceData, policy);
  },
);

type WorkerMessage =
  | { action: "updateAttendance" }
  | { action: "fetchArchiveMonth"; monthsAgo: number };

type WorkerResponse =
  | { status: "success"; result: string | void }
  | { status: "error"; message: string };

chrome.runtime.onMessage.addListener(
  (
    request: WorkerMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: WorkerResponse) => void,
  ): boolean => {
    const work: Promise<string | void> | null =
      request.action === "updateAttendance"
        ? refreshAttendance()
        : request.action === "fetchArchiveMonth"
          ? fetchArchiveMonth(request.monthsAgo)
          : null;

    if (!work) {
      return false;
    }

    work
      .then((result: string | void): void =>
        sendResponse({ status: "success", result }),
      )
      .catch((error: unknown): void =>
        sendResponse({ status: "error", message: (error as Error).message }),
      );

    return true;
  },
);
