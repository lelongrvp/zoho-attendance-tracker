import type { VNode } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Translator } from "../../lib/i18n.ts";
import type {
  ArchivedMonth,
  AttendanceData,
  Cycle,
  Lang,
  Policy,
  ZohoDay,
} from "../../lib/types.ts";
import {
  getCycleAt,
  monthKeysInRange,
  monthsAgoFor,
  toLocalDateKey,
} from "../../lib/policy.ts";
import type { CalendarCellState } from "../derive.ts";
import {
  buildCalendarDays,
  buildDayByKey,
  buildFetchableMonths,
  buildKnownMonths,
  deriveCalendarCells,
  deriveCycleLabel,
  mondayFirstOffset,
} from "../derive.ts";
import { CalendarGrid } from "./CalendarGrid.tsx";
import { Legend } from "./Legend.tsx";
import { ChevronIcon } from "./Icons.tsx";

const MIN_CALENDAR_OFFSET: number = -12;
const STEP_BUTTON_CLASS: string =
  "grid size-[19px] flex-none place-items-center rounded-panel border border-rule-strong bg-transparent text-ink-3 enabled:hover:border-ink-3 enabled:hover:bg-wash enabled:hover:text-ink disabled:cursor-default disabled:opacity-30";

type ArchiveFetchResponse = { status?: string; message?: string } | undefined;

export type CalendarViewProps = {
  attendanceData: AttendanceData | undefined;
  archivedMonths: Record<string, ArchivedMonth> | undefined;
  policy: Policy;
  lang: Lang;
  translate: Translator;
  refreshNonce: number;
};

export function CalendarView({
  attendanceData,
  archivedMonths,
  policy,
  lang,
  translate,
  refreshNonce,
}: CalendarViewProps): VNode {
  const [calendarOffset, setCalendarOffset] = useState<number>(0);
  const archiveRequestsRef = useRef<Set<string>>(new Set<string>());
  const [archiveFailures, setArchiveFailures] = useState<Map<string, string>>(
    new Map<string, string>(),
  );

  const now: Date = new Date();
  const cycle: Cycle = getCycleAt(now, policy, calendarOffset);
  const label: string = deriveCycleLabel(cycle.start, cycle.end, lang);
  const cycleMonths: string[] = monthKeysInRange(cycle.start, cycle.end);
  const knownMonths: Set<string> = buildKnownMonths(archivedMonths, now);
  const fetchable: string[] = buildFetchableMonths(
    cycleMonths,
    knownMonths,
    now,
  );
  const calendarDays: ZohoDay[] = buildCalendarDays(
    attendanceData,
    archivedMonths,
  );
  const dayByKey: Map<string, ZohoDay> = buildDayByKey(
    calendarDays,
    cycle.start,
    cycle.end,
  );
  const todayKey: string = toLocalDateKey(now);
  const cells: CalendarCellState[] = deriveCalendarCells(
    cycle.start,
    cycle.end,
    dayByKey,
    todayKey,
    policy,
    lang,
    translate,
  );
  const leadingSpacers: number = mondayFirstOffset(cycle.start);

  useEffect((): void => {
    archiveRequestsRef.current.clear();
    setArchiveFailures(new Map<string, string>());
  }, [refreshNonce]);

  useEffect((): void => {
    for (const key of fetchable) {
      if (archiveRequestsRef.current.has(key)) {
        continue;
      }
      archiveRequestsRef.current.add(key);
      const monthsAgo: number = monthsAgoFor(key, now);
      chrome.runtime
        .sendMessage({ action: "fetchArchiveMonth", monthsAgo })
        .then((response: ArchiveFetchResponse): void => {
          if (response?.status !== "success") {
            setArchiveFailures(
              (previous: Map<string, string>): Map<string, string> =>
                new Map(previous).set(
                  key,
                  response?.message || translate("calFetchFailed"),
                ),
            );
          }
        })
        .catch((): void => {
          setArchiveFailures(
            (previous: Map<string, string>): Map<string, string> =>
              new Map(previous).set(key, translate("calFetchFailed")),
          );
        });
    }
  }, [attendanceData, archivedMonths, policy, calendarOffset]);

  const failedMonth: string | undefined = cycleMonths.find(
    (key: string): boolean => archiveFailures.has(key),
  );
  const note: string = failedMonth
    ? (archiveFailures.get(failedMonth) ?? "")
    : fetchable.length > 0
      ? translate("calFetching")
      : "";

  return (
    <>
      <div class="mt-4 flex items-baseline gap-2.5 border-b border-ink pb-[7px]">
        <h2 class="text-[11px] font-bold tracking-[0.1em] text-ink uppercase">
          {translate("cycleCalendar")}
        </h2>
        <div class="ml-auto flex items-center gap-[3px] self-center">
          <button
            type="button"
            title={translate("calPrev")}
            aria-label={translate("calPrev")}
            disabled={calendarOffset <= MIN_CALENDAR_OFFSET}
            onClick={(): void =>
              setCalendarOffset((offset: number): number =>
                Math.max(MIN_CALENDAR_OFFSET, offset - 1),
              )
            }
            class={STEP_BUTTON_CLASS}
          >
            <ChevronIcon direction="left" className="block size-[11px]" />
          </button>
          <span class="min-w-[94px] text-center font-num text-[10px] tracking-[0.02em] whitespace-nowrap text-ink-3">
            {label}
          </span>
          <button
            type="button"
            title={translate("calNext")}
            aria-label={translate("calNext")}
            disabled={calendarOffset >= 0}
            onClick={(): void =>
              setCalendarOffset((offset: number): number =>
                Math.min(0, offset + 1),
              )
            }
            class={STEP_BUTTON_CLASS}
          >
            <ChevronIcon direction="right" className="block size-[11px]" />
          </button>
        </div>
      </div>

      <CalendarGrid
        cells={cells}
        leadingSpacers={leadingSpacers}
        translate={translate}
      />

      <div class="mt-2 font-num text-[9.5px] text-ink-faint">{note}</div>

      <Legend translate={translate} />
    </>
  );
}
