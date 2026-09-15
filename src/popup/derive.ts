import type {
  ActiveCheckin,
  ArchivedMonth,
  AttendanceData,
  Lang,
  LastError,
  NonWorkingKind,
  Policy,
  Targets,
  WorkedTargets,
  ZohoDay,
} from "@/lib/types.ts";
import type { Translator } from "@/lib/i18n.ts";
import { monthNames } from "@/lib/i18n.ts";
import {
  classifyNonWorkingDay,
  computeEffectiveTargets,
  computeWorkedTargets,
  findDay,
  workingFraction,
  describeAttendanceRequest,
  findActiveCheckin,
  getCurrentCycle,
  hasAttendanceRequest,
  isPastLateThreshold,
  monthKey,
  monthsAgoFor,
  pad,
  parseZohoTimestamp,
  toLocalDateKey,
} from "@/lib/policy.ts";
import {
  formatAgo,
  formatDayLabel,
  formatDuration,
  formatTime,
} from "./format.ts";

export const AUTO_REFRESH_AFTER_MS: number = 5 * 60 * 1000;

export function shouldRequestBackgroundRefresh(
  csrfToken: string | undefined,
  lastSuccessAt: number | undefined,
  alreadyRequested: boolean,
  now: number,
): boolean {
  if (alreadyRequested || !csrfToken) {
    return false;
  }
  if (lastSuccessAt && now - lastSuccessAt < AUTO_REFRESH_AFTER_MS) {
    return false;
  }
  return true;
}

export type AlertState =
  { kind: "hidden" } | { kind: "login" } | { kind: "error"; message: string };

export function deriveAlert(
  csrfToken: string | undefined,
  lastError: LastError | null | undefined,
  lastSuccessAt: number | undefined,
): AlertState {
  if (!csrfToken) {
    return { kind: "login" };
  }
  if (lastError && (!lastSuccessAt || lastError.at > lastSuccessAt)) {
    return { kind: "error", message: lastError.message };
  }
  return { kind: "hidden" };
}

export type Freshness = { text: string; stale: boolean };

export function deriveFreshness(
  lastSuccessAt: number | undefined,
  staleAfterMinutes: number,
  translate: Translator,
  now: number,
): Freshness {
  if (!lastSuccessAt) {
    return { text: translate("neverUpdated"), stale: true };
  }
  const minutes: number = Math.floor((now - lastSuccessAt) / 60000);
  return {
    text: translate("updatedAgo", { t: formatAgo(minutes, translate) }),
    stale: minutes >= staleAfterMinutes,
  };
}

export type ActiveToday = {
  checkin: Date;
  isFromYesterday: boolean;
  checkout1: Date;
  fulltime: Date;
  day: ZohoDay | null;
};

export function deriveActiveToday(
  attendanceData: AttendanceData | undefined,
  now: Date,
  policy: Policy,
): ActiveToday | null {
  const active: ActiveCheckin | null = findActiveCheckin(
    attendanceData,
    now,
    policy,
  );
  if (!active) {
    return null;
  }
  const targets: Targets = computeEffectiveTargets(
    attendanceData,
    active,
    now,
    policy,
  );
  const day: ZohoDay | null = findDay(attendanceData, active.checkin);
  return {
    checkin: active.checkin,
    isFromYesterday: active.isFromYesterday,
    checkout1: targets.partTime,
    fulltime: targets.fullTime,
    day,
  };
}

export type TimerStateClass = "time-active" | "time-late" | "time-completed";
export type TimerState = { text: string; stateClass: TimerStateClass };

export function deriveTimerState(
  targetDate: Date | null,
  checkinDate: Date | null,
  policy: Policy,
  now: number,
  translate: Translator,
): TimerState {
  if (!targetDate || !checkinDate) {
    return { text: "--:--:--", stateClass: "time-active" };
  }
  const diffMs: number = targetDate.getTime() - now;
  const isLate: boolean = isPastLateThreshold(targetDate, checkinDate, policy);

  if (diffMs <= 0) {
    const overSecs: number = Math.floor(Math.abs(diffMs) / 1000);
    const overHours: number = Math.floor(overSecs / 3600);
    const overMins: number = Math.floor((overSecs % 3600) / 60);
    const overText: string =
      overHours > 0 || overMins > 0
        ? translate("completedOver", { h: overHours, m: overMins })
        : translate("completed");
    return {
      text: overText,
      stateClass: isLate ? "time-late" : "time-completed",
    };
  }

  return {
    text: translate("timeLeft", { t: formatDuration(diffMs) }),
    stateClass: isLate ? "time-late" : "time-active",
  };
}

export function deriveProgressPercent(
  checkin: Date,
  fulltime: Date,
  now: number,
): number | null {
  const totalDuration: number = fulltime.getTime() - checkin.getTime();
  if (totalDuration <= 0) {
    return null;
  }
  const elapsed: number = now - checkin.getTime();
  return Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100);
}

export function derivePartTimeMarkerPercent(
  checkin: Date,
  checkout1: Date,
  fulltime: Date,
): number {
  const spanMs: number = fulltime.getTime() - checkin.getTime();
  const partFraction: number =
    (checkout1.getTime() - checkin.getTime()) / spanMs;
  return partFraction * 100;
}

export type WorkedLineState = {
  text: string;
  diverges: boolean;
  tooltip: string;
};

export function deriveWorkedLine(
  day: ZohoDay | null,
  now: Date,
  policy: Policy,
  fulltimeDate: Date | null,
  translate: Translator,
): WorkedLineState | null {
  const workedTargets: WorkedTargets | null = computeWorkedTargets(
    day,
    now,
    policy,
  );
  if (!workedTargets) {
    return null;
  }

  const workedMinutes: number = Math.floor(workedTargets.workedMs / 60000);
  let text: string = translate("workedLine", {
    h: Math.floor(workedMinutes / 60),
    m: pad(workedMinutes % 60),
  });
  text += workedTargets.isOpen
    ? translate("workedFullAt", { t: formatTime(workedTargets.fullTime) })
    : translate("workedCheckedOut");

  const diverges: boolean =
    policy.targetMode === "offset" &&
    workedTargets.isOpen &&
    fulltimeDate !== null &&
    Math.abs(workedTargets.fullTime.getTime() - fulltimeDate.getTime()) >
      10 * 60 * 1000;

  return {
    text,
    diverges,
    tooltip: diverges ? translate("divergeTooltip") : "",
  };
}

export function deriveCycleLabel(start: Date, end: Date, lang: Lang): string {
  const months: string[] = monthNames(lang);
  return `${start.getDate()} ${months[start.getMonth()]} - ${end.getDate()} ${months[end.getMonth()]}`;
}

export type QuotaRecord = { label: string; hours?: string; note?: string };
export type HistoryDay = { label: string; tsecs: number; fraction: number };

export type CycleUsageDerived = {
  label: string;
  days6To8Hours: QuotaRecord[];
  daysBelow6Hours: QuotaRecord[];
  requestDays: QuotaRecord[];
  cycleDays: HistoryDay[];
  leaveUsed: number;
  absentCount: number;
  workedSeconds: number;
  workedDays: number;
  balanceSeconds: number;
};

export function deriveCycleUsage(
  dayList: Record<string, ZohoDay>,
  now: Date,
  policy: Policy,
  lang: Lang,
): CycleUsageDerived {
  const { start, end } = getCurrentCycle(now, policy);
  const label: string = deriveCycleLabel(start, end, lang);

  const days6To8Hours: QuotaRecord[] = [];
  const daysBelow6Hours: QuotaRecord[] = [];
  const requestDays: QuotaRecord[] = [];
  const cycleDays: HistoryDay[] = [];
  let leaveUsed: number = 0;
  let absentCount: number = 0;
  let workedSeconds: number = 0;
  let workedDays: number = 0;
  let obligationSeconds: number = 0;

  Object.values(dayList).forEach((day: ZohoDay): void => {
    const dayDate: Date | null = parseZohoTimestamp(day.orgdate);
    if (!dayDate || dayDate < start || dayDate > end) {
      return;
    }

    const tsecs: number = Number(day.tsecs) || 0;
    const fraction: number = workingFraction(day);
    const dayLabel: string = formatDayLabel(dayDate, lang);
    const record: QuotaRecord = {
      label: dayLabel,
      hours: (tsecs / 3600).toFixed(1),
    };

    cycleDays.push({ label: dayLabel, tsecs, fraction });

    if (tsecs > 0) {
      workedSeconds += tsecs;
      workedDays++;
      obligationSeconds += policy.fullDaySeconds * fraction;
      if (tsecs < policy.shortDaySeconds * fraction) {
        daysBelow6Hours.push(record);
      } else if (tsecs < policy.fullDaySeconds * fraction) {
        days6To8Hours.push(record);
      }
    }

    if (hasAttendanceRequest(day)) {
      requestDays.push({
        label: dayLabel,
        note: describeAttendanceRequest(day),
      });
    }
    leaveUsed += Number(day.leaveDaysTaken) || 0;
    if ((day.status || "").trim() === "Absent") {
      absentCount++;
    }
  });

  const balanceSeconds: number = workedSeconds - obligationSeconds;

  return {
    label,
    days6To8Hours,
    daysBelow6Hours,
    requestDays,
    cycleDays,
    leaveUsed,
    absentCount,
    workedSeconds,
    workedDays,
    balanceSeconds,
  };
}

export type QuotaPillState = "alert" | "warn" | "active" | "none";

export function deriveSlotsToShow(count: number, totalSlots: number): number {
  return Math.max(totalSlots, count);
}

export function deriveQuotaPillState(
  count: number,
  totalSlots: number,
  isWarning: boolean,
): QuotaPillState {
  if (count > totalSlots || (isWarning && count > 0)) {
    return "alert";
  }
  if (count > 0) {
    return count === totalSlots ? "warn" : "active";
  }
  return "none";
}

export type HistoryBarKind = "none" | "empty" | "low" | "short";
export type HistoryBar = {
  label: string;
  tsecs: number;
  heightPercent: number;
  kind: HistoryBarKind;
};
export type HistoryRefLine = { bottomPercent: number };

export function deriveHistoryScale(
  cycleDays: HistoryDay[],
  fullDaySeconds: number,
): number {
  return Math.max(
    fullDaySeconds,
    ...cycleDays.map((day: HistoryDay): number => day.tsecs),
  );
}

export function deriveHistoryRefLines(
  policy: Policy,
  scaleSeconds: number,
): HistoryRefLine[] {
  const lines: HistoryRefLine[] = [];
  for (const thresholdSeconds of [
    policy.shortDaySeconds,
    policy.fullDaySeconds,
  ]) {
    const bottomPercent: number = (thresholdSeconds / scaleSeconds) * 100;
    if (bottomPercent < 98) {
      lines.push({ bottomPercent });
    }
  }
  return lines;
}

export function deriveHistoryBars(
  cycleDays: HistoryDay[],
  policy: Policy,
  scaleSeconds: number,
): HistoryBar[] {
  return cycleDays.map((day: HistoryDay): HistoryBar => {
    const kind: HistoryBarKind =
      day.tsecs === 0
        ? "empty"
        : day.tsecs < policy.shortDaySeconds * day.fraction
          ? "low"
          : day.tsecs < policy.fullDaySeconds * day.fraction
            ? "short"
            : "none";
    const heightPercent: number = Math.max(
      (day.tsecs / scaleSeconds) * 100,
      day.tsecs > 0 ? 4 : 2,
    );
    return { label: day.label, tsecs: day.tsecs, heightPercent, kind };
  });
}

export function buildCalendarDays(
  attendanceData: AttendanceData | undefined,
  archivedMonths: Record<string, ArchivedMonth> | undefined,
): ZohoDay[] {
  return [
    ...Object.values(archivedMonths ?? {}).flatMap(
      (month: ArchivedMonth): ZohoDay[] => Object.values(month.dayList ?? {}),
    ),
    ...Object.values(attendanceData?.dayList ?? {}),
  ];
}

export function buildKnownMonths(
  archivedMonths: Record<string, ArchivedMonth> | undefined,
  today: Date,
): Set<string> {
  return new Set<string>([
    monthKey(today),
    monthKey(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
    ...Object.keys(archivedMonths ?? {}),
  ]);
}

export function buildFetchableMonths(
  cycleMonths: string[],
  knownMonths: Set<string>,
  today: Date,
): string[] {
  return cycleMonths.filter(
    (key: string): boolean =>
      !knownMonths.has(key) && monthsAgoFor(key, today) >= 1,
  );
}

export function buildDayByKey(
  calendarDays: ZohoDay[],
  start: Date,
  end: Date,
): Map<string, ZohoDay> {
  const dayByKey: Map<string, ZohoDay> = new Map<string, ZohoDay>();
  calendarDays.forEach((day: ZohoDay): void => {
    const date: Date | null = parseZohoTimestamp(day.orgdate);
    if (date && date >= start && date <= end) {
      dayByKey.set(toLocalDateKey(date), day);
    }
  });
  return dayByKey;
}

export function mondayFirstOffset(start: Date): number {
  return (start.getDay() + 6) % 7;
}

export type CalendarCellStatus =
  | "leave"
  | "absent"
  | "full"
  | "short"
  | "low"
  | "holiday"
  | "weekend"
  | "future"
  | "off";

export type CalendarCellState = {
  key: string;
  dateNum: number;
  status: CalendarCellStatus;
  hasRequest: boolean;
  isToday: boolean;
  title: string;
};

export function deriveCalendarCells(
  start: Date,
  end: Date,
  dayByKey: Map<string, ZohoDay>,
  todayKey: string,
  policy: Policy,
  lang: Lang,
  translate: Translator,
): CalendarCellState[] {
  const cells: CalendarCellState[] = [];

  for (
    const cursor: Date = new Date(start);
    cursor <= end;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const key: string = toLocalDateKey(cursor);
    const day: ZohoDay | undefined = dayByKey.get(key);
    const isFuture: boolean = key > todayKey;
    let title: string = formatDayLabel(cursor, lang);
    let status: CalendarCellStatus;
    let hasRequest: boolean = false;

    if (day) {
      const tsecs: number = Number(day.tsecs) || 0;
      const fraction: number = workingFraction(day);
      // Part-day leave is a leave day only if nothing was worked; otherwise the
      // hours decide, measured against what that fraction of a day actually owed.
      if (fraction <= 0 || (fraction < 1 && tsecs === 0)) {
        status = "leave";
      } else if ((day.status || "").trim() === "Absent") {
        status = "absent";
      } else if (tsecs >= policy.fullDaySeconds * fraction) {
        status = "full";
      } else if (tsecs >= policy.shortDaySeconds * fraction) {
        status = "short";
      } else if (tsecs > 0) {
        status = "low";
      } else {
        const nonWorking: NonWorkingKind = classifyNonWorkingDay(day, policy);
        status = nonWorking !== "" ? nonWorking : isFuture ? "future" : "off";
      }

      if (tsecs > 0) {
        title += ` · ${(tsecs / 3600).toFixed(1)}h`;
      }
      const statusText: string = (day.status || "").trim();
      if (statusText) {
        title += ` · ${statusText}`;
      }
      if (hasAttendanceRequest(day)) {
        hasRequest = true;
        title += ` · ${translate("calRequest")}`;
        const detail: string = describeAttendanceRequest(day);
        if (detail) {
          title += ` (${detail})`;
        }
      }
    } else {
      status = isFuture ? "future" : "off";
      title += ` · ${translate("calNoData")}`;
    }

    cells.push({
      key,
      dateNum: cursor.getDate(),
      status,
      hasRequest,
      isToday: key === todayKey,
      title,
    });
  }

  return cells;
}
