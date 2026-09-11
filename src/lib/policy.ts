import type {
  ActiveCheckin,
  AttendanceData,
  Cycle,
  NonWorkingKind,
  Policy,
  StatusCount,
  Targets,
  WorkedTargets,
  WorkedTime,
  ZohoDay,
  ZohoEntry,
} from "./types.ts";
import { read, readOne } from "./storage.ts";

// Attendance policy and the date handling both the worker and the popup need.
export const DEFAULT_POLICY: Policy = {
  cycleStartDay: 21,
  fullDaySeconds: 8 * 3600,
  shortDaySeconds: 6 * 3600,
  earlyPartTimeHours: 7.25,
  earlyFullTimeHours: 9.25,
  latePartTimeHours: 6,
  lateFullTimeHours: 8,
  lateStartAfterMinutes: 13 * 60 + 15,
  lateThresholdMinutes: 19 * 60 + 30,
  targetMode: "offset",
  shortDayQuota: 5,
  requestQuota: 3,
  holidayStatuses: ["holiday", "ngày lễ", "nghỉ lễ"],
  weekendStatuses: ["weekend", "week off", "weekly off", "off day"],
  violationQuota: 3,
  staleAfterMinutes: 30,
};

export async function readPolicy(): Promise<Policy> {
  const { policy } = await read(["policy"]);
  return { ...DEFAULT_POLICY, ...(policy ?? {}) };
}

export const DEFAULT_PORTAL_ID: string = "hrportal1524046581683";

export async function readPortalId(): Promise<string> {
  return (await readOne("portalId")) || DEFAULT_PORTAL_ID;
}

const ZOHO_TIMESTAMP: RegExp =
  /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/;
const ZOHO_DMY: RegExp =
  /^(\d{1,2})-([A-Za-z]{3})-(\d{4})(?:\s*-?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp])\.?[Mm]\.?)?)?$/;
const MONTH_INDEX: Record<string, number | undefined> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const warnedValues: Set<string> = new Set<string>();

function warnOnce(value: unknown): void {
  const key: string = String(value);
  if (warnedValues.has(key) || warnedValues.size >= 50) {
    return;
  }
  warnedValues.add(key);
  console.warn("[attendance] Unrecognised Zoho date (skipped):", key);
}

export function isPlaceholderTime(value: unknown): boolean {
  return (
    value == null || String(value).trim() === "" || String(value).trim() === "-"
  );
}

export function pad(num: number): string {
  return String(num).padStart(2, "0");
}

export function isZohoDate(value: unknown): boolean {
  return (
    ZOHO_TIMESTAMP.test(String(value)) || ZOHO_DMY.test(String(value).trim())
  );
}

export function parseZohoTimestamp(value: unknown): Date | null {
  if (isPlaceholderTime(value)) {
    return null;
  }

  const iso: RegExpExecArray | null = ZOHO_TIMESTAMP.exec(String(value));
  if (iso) {
    const [, year, month, day, hours, minutes, seconds] = iso;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours ?? 0),
      Number(minutes ?? 0),
      Number(seconds ?? 0),
    );
  }

  const dmy: RegExpExecArray | null = ZOHO_DMY.exec(String(value).trim());
  if (dmy) {
    const [, day, monthName, year, hours, minutes, seconds, meridiem] = dmy;
    const monthIndex: number | undefined =
      MONTH_INDEX[String(monthName).toLowerCase()];
    if (monthIndex !== undefined) {
      let hour: number = Number(hours ?? 0);
      if (meridiem) {
        hour = (hour % 12) + (/[Pp]/.test(meridiem) ? 12 : 0);
      }
      return new Date(
        Number(year),
        monthIndex,
        Number(day),
        hour,
        Number(minutes ?? 0),
        Number(seconds ?? 0),
      );
    }
  }

  warnOnce(value);
  return null;
}

export function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function findCheckin(
  attendanceData: AttendanceData | undefined,
  date: Date,
): Date | null {
  const entries: ZohoEntry[] =
    attendanceData?.entries?.[toLocalDateKey(date)] ?? [];
  for (const entry of entries) {
    const checkin: Date | null = parseZohoTimestamp(entry.fdate);
    if (checkin) {
      return checkin;
    }
  }
  return null;
}

export function findActiveCheckin(
  attendanceData: AttendanceData | undefined,
  now: Date,
  policy: Policy,
  { allowElapsed = false }: { allowElapsed?: boolean } = {},
): ActiveCheckin | null {
  const todayCheckin: Date | null = findCheckin(attendanceData, now);
  if (todayCheckin) {
    return { checkin: todayCheckin, isFromYesterday: false };
  }

  const yesterday: Date = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayCheckin: Date | null = findCheckin(attendanceData, yesterday);
  if (
    yesterdayCheckin &&
    (allowElapsed ||
      computeTargets(yesterdayCheckin, policy).fullTime.getTime() >
        now.getTime())
  ) {
    return { checkin: yesterdayCheckin, isFromYesterday: true };
  }

  return null;
}

export function computeTargets(checkinDate: Date, policy: Policy): Targets {
  const checkinMinutes: number =
    checkinDate.getHours() * 60 + checkinDate.getMinutes();
  const isLateStart: boolean = checkinMinutes >= policy.lateStartAfterMinutes;
  const partTimeHours: number = isLateStart
    ? policy.latePartTimeHours
    : policy.earlyPartTimeHours;
  const fullTimeHours: number = isLateStart
    ? policy.lateFullTimeHours
    : policy.earlyFullTimeHours;

  return {
    partTime: new Date(checkinDate.getTime() + partTimeHours * 3600 * 1000),
    fullTime: new Date(checkinDate.getTime() + fullTimeHours * 3600 * 1000),
  };
}

export function computeWorkedMs(
  dayEntries: ZohoEntry[] | null | undefined,
  now: Date,
): WorkedTime | null {
  if (!dayEntries || dayEntries.length === 0) {
    return null;
  }

  let workedMs: number = 0;
  let openSince: Date | null = null;

  if (dayEntries.some((entry) => entry.tdate !== undefined)) {
    for (const entry of dayEntries) {
      const from: Date | null = parseZohoTimestamp(entry.fdate);
      if (!from) {
        continue;
      }
      const to: Date | null = parseZohoTimestamp(entry.tdate);
      if (to) {
        workedMs += Math.max(0, to.getTime() - from.getTime());
      } else {
        openSince = from;
      }
    }
  } else {
    const punches: Date[] = dayEntries
      .map((entry: ZohoEntry): Date | null => parseZohoTimestamp(entry.fdate))
      .filter((punch: Date | null): punch is Date => punch !== null);
    for (let i = 0; i + 1 < punches.length; i += 2) {
      const from: Date | undefined = punches[i];
      const to: Date | undefined = punches[i + 1];
      if (from && to) {
        workedMs += Math.max(0, to.getTime() - from.getTime());
      }
    }
    if (punches.length % 2 === 1) {
      openSince = punches[punches.length - 1] ?? null;
    }
  }

  if (openSince) {
    workedMs += Math.max(0, now.getTime() - openSince.getTime());
  }

  return { workedMs, isOpen: openSince !== null };
}

export function computeWorkedTargets(
  dayEntries: ZohoEntry[] | null | undefined,
  now: Date,
  policy: Policy,
): WorkedTargets | null {
  const worked: WorkedTime | null = computeWorkedMs(dayEntries, now);
  if (!worked) {
    return null;
  }
  return {
    partTime: new Date(
      now.getTime() + policy.shortDaySeconds * 1000 - worked.workedMs,
    ),
    fullTime: new Date(
      now.getTime() + policy.fullDaySeconds * 1000 - worked.workedMs,
    ),
    workedMs: worked.workedMs,
    isOpen: worked.isOpen,
  };
}

// The authoritative targets for countdowns, gates and the badge. Worked mode
// applies only while a session is open — with everything checked out the
// projection would drift forward one second per second — and falls back to
// the offset model otherwise.
export function computeEffectiveTargets(
  attendanceData: AttendanceData | undefined,
  active: ActiveCheckin,
  now: Date,
  policy: Policy,
): Targets {
  if (policy.targetMode === "worked") {
    const dayEntries: ZohoEntry[] | undefined =
      attendanceData?.entries?.[toLocalDateKey(active.checkin)];
    const workedTargets: WorkedTargets | null = computeWorkedTargets(
      dayEntries,
      now,
      policy,
    );
    if (workedTargets && workedTargets.isOpen) {
      return {
        partTime: workedTargets.partTime,
        fullTime: workedTargets.fullTime,
      };
    }
  }
  return computeTargets(active.checkin, policy);
}

// Anchored to the day work started, not to the target's own day: a late start
// can push the full-time target past midnight, and 00:30 is late by any
// reading even though it precedes 19:30 of its own calendar day.
export function isPastLateThreshold(
  targetDate: Date,
  anchorDate: Date,
  policy: Policy,
): boolean {
  const threshold: Date = new Date(anchorDate ?? targetDate);
  threshold.setHours(0, policy.lateThresholdMinutes, 0, 0);
  return targetDate >= threshold;
}

// The cycle runs from cycleStartDay of one month to the day before it in the next.
export function getCurrentCycle(now: Date, policy: Policy): Cycle {
  const startDay: number = policy.cycleStartDay;
  if (now.getDate() >= startDay) {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), startDay),
      end: new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        startDay - 1,
        23,
        59,
        59,
      ),
    };
  }
  return {
    start: new Date(now.getFullYear(), now.getMonth() - 1, startDay),
    end: new Date(now.getFullYear(), now.getMonth(), startDay - 1, 23, 59, 59),
  };
}

// Guards the cache against a Zoho schema change: a payload that parses as JSON
// but no longer looks like attendance must not overwrite good data, because
// the popup would render it as a wall of confident zeroes.
export function isUsablePayload(data: unknown): boolean {
  const days: ZohoDay[] = Object.values(
    (data as AttendanceData | undefined)?.dayList ?? {},
  );
  if (days.length === 0) {
    return false;
  }
  return (
    days.every((day: ZohoDay): boolean => isZohoDate(day.orgdate)) &&
    days.some((day: ZohoDay): boolean => Number.isFinite(Number(day.tsecs)))
  );
}

// An attendance request ("regulation ticket") arrives as approvalInfo on the
// day it covers. The shape is still unverified (see README), so this answers
// only "is there something here" — defensively, because the plain truthiness
// test it replaces counted an empty object or array as a used request.
export function hasAttendanceRequest(day: ZohoDay | undefined): boolean {
  const info: unknown = day?.approvalInfo;
  if (!info) {
    return false;
  }
  if (Array.isArray(info)) {
    return info.length > 0;
  }
  if (typeof info === "object") {
    return Object.keys(info).length > 0;
  }
  return String(info).trim() !== "";
}

// Whatever approvalInfo actually holds, verbatim and truncated, for tooltips.
// Interpreting it would mean guessing at an unverified shape; showing it is
// also how the assumption finally gets checked - from the popup, on a real
// day, without opening the console.
export function describeAttendanceRequest(day: ZohoDay | undefined): string {
  if (!hasAttendanceRequest(day)) {
    return "";
  }
  const info: unknown = day?.approvalInfo;
  const text: string =
    typeof info === "string" ? info.trim() : JSON.stringify(info);
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

// Holiday is tested first on purpose: a status like "Weekend/Holiday" means a
// holiday that happens to land on a weekend, and the holiday is the more
// informative of the two labels. Returns "" for anything unmatched, which
// leaves the day rendering exactly as it did before this existed.
export function classifyNonWorkingDay(
  day: ZohoDay | undefined,
  policy: Policy,
): NonWorkingKind {
  const status: string = (day?.status ?? "").trim().toLowerCase();
  if (!status) {
    return "";
  }
  const matches = (words: string[] | undefined): boolean =>
    (words ?? []).some((word: string): boolean => {
      const needle: string = String(word).trim().toLowerCase();
      return needle !== "" && status.includes(needle);
    });
  if (matches(policy.holidayStatuses)) {
    return "holiday";
  }
  if (matches(policy.weekendStatuses)) {
    return "weekend";
  }
  return "";
}

// Distinct status strings in the cache, most frequent first. The options page
// shows these so the keyword lists above can be matched against what this
// portal actually sends, rather than against what this file guesses it sends.
export function collectStatuses(
  dayList: Record<string, ZohoDay> | ZohoDay[] | undefined,
): StatusCount[] {
  const counts: Map<string, number> = new Map<string, number>();
  Object.values(dayList || {}).forEach((day) => {
    const status: string = (day?.status ?? "").trim();
    if (status !== "") {
      counts.set(status, (counts.get(status) || 0) + 1);
    }
  });
  return [...counts.entries()]
    .sort(
      (first: [string, number], second: [string, number]): number =>
        second[1] - first[1],
    )
    .map(([status, count]: [string, number]): StatusCount => ({
      status,
      count,
    }));
}

// The cycle `offset` cycles away from the one containing `now`; 0 is current,
// -1 the previous one. Shifting the start date by whole months is safe
// because cycleStartDay is a day every month has.
export function getCycleAt(now: Date, policy: Policy, offset: number): Cycle {
  const current: Cycle = getCurrentCycle(now, policy);
  if (offset === 0) {
    return current;
  }
  const start: Date = new Date(
    current.start.getFullYear(),
    current.start.getMonth() + offset,
    policy.cycleStartDay,
  );
  return {
    start,
    end: new Date(
      start.getFullYear(),
      start.getMonth() + 1,
      policy.cycleStartDay - 1,
      23,
      59,
      59,
    ),
  };
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

// Every calendar month a cycle touches - two of them, unless cycleStartDay is
// 1. Used to work out which months a past cycle needs before it can render.
export function monthKeysInRange(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const cursor: Date = new Date(start.getFullYear(), start.getMonth(), 1);
  const last: Date = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    keys.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

// How many months back from now a month key sits, which is exactly the
// `preMonth` value Zoho's endpoint takes.
export function monthsAgoFor(key: string, now: Date): number {
  const [year = 0, month = 1] = key.split("-").map(Number);
  return now.getFullYear() * 12 + now.getMonth() - (year * 12 + month - 1);
}
