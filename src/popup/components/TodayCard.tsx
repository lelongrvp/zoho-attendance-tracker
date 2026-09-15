import type { VNode } from "preact";
import type { Translator } from "../../lib/i18n.ts";
import type { Policy } from "../../lib/types.ts";
import type { ActiveToday, TimerState, TimerStateClass } from "../derive.ts";
import {
  derivePartTimeMarkerPercent,
  deriveProgressPercent,
  deriveTimerState,
} from "../derive.ts";
import { formatTime } from "../format.ts";
import { DoneIcon, WarningIcon } from "./Icons.tsx";
import { WorkedLine } from "./WorkedLine.tsx";

const EYEBROW_CLASS: string =
  "text-[10px] font-semibold tracking-[0.09em] text-ink-3 uppercase";
const META_VALUE_CLASS: string =
  "font-num text-[12px] font-semibold tracking-[-0.01em] tabular-nums whitespace-nowrap text-ink select-text";
const COUNTDOWN_CLASS: string =
  "flex items-center overflow-hidden border-l-2 font-num tabular-nums whitespace-nowrap select-text transition-[color,border-color] duration-200 ease-[ease]";
const COUNTDOWN_STATE_CLASS: Record<TimerStateClass, string> = {
  "time-active": "border-l-ink text-ink",
  "time-late": "border-l-stamp text-stamp",
  "time-completed": "border-l-moss text-moss",
};

function StateGlyph({
  stateClass,
  className,
  strokeWidth,
}: {
  stateClass: TimerStateClass;
  className: string;
  strokeWidth: string;
}): VNode | null {
  if (stateClass === "time-late") {
    return <WarningIcon className={className} strokeWidth={strokeWidth} />;
  }
  if (stateClass === "time-completed") {
    return <DoneIcon className={className} strokeWidth={strokeWidth} />;
  }
  return null;
}

export type TodayCardProps = {
  activeToday: ActiveToday | null;
  now: number;
  policy: Policy;
  translate: Translator;
};

export function TodayCard({
  activeToday,
  now,
  policy,
  translate,
}: TodayCardProps): VNode {
  const pending: TimerState = {
    text: translate("pending"),
    stateClass: "time-active",
  };
  const fulltimeTimer: TimerState = activeToday
    ? deriveTimerState(
        activeToday.fulltime,
        activeToday.checkin,
        policy,
        now,
        translate,
      )
    : pending;
  const partTimeTimer: TimerState = activeToday
    ? deriveTimerState(
        activeToday.checkout1,
        activeToday.checkin,
        policy,
        now,
        translate,
      )
    : pending;

  const checkinLabel: string = activeToday
    ? activeToday.isFromYesterday
      ? translate("yesterdayAt", { t: formatTime(activeToday.checkin) })
      : formatTime(activeToday.checkin)
    : translate("noRecordToday");
  const progressPercent: number = activeToday
    ? (deriveProgressPercent(activeToday.checkin, activeToday.fulltime, now) ??
      0)
    : 0;
  const markerPercent: number | null = activeToday
    ? derivePartTimeMarkerPercent(
        activeToday.checkin,
        activeToday.checkout1,
        activeToday.fulltime,
      )
    : null;

  return (
    <section class="mt-[13px] rounded-panel border border-rule bg-panel px-[14px] pt-[13px] pb-[14px]">
      <div class="flex items-baseline gap-3">
        <div class="flex items-baseline gap-1.5 whitespace-nowrap">
          <span class={EYEBROW_CLASS}>{translate("checkedIn")}</span>
          <span class={META_VALUE_CLASS}>{checkinLabel}</span>
        </div>
        <div class="ml-auto flex items-baseline gap-1.5 whitespace-nowrap">
          <span class={EYEBROW_CLASS}>{translate("fullTime")}</span>
          <span class={META_VALUE_CLASS}>
            {activeToday ? formatTime(activeToday.fulltime) : "--:--"}
          </span>
        </div>
      </div>

      <div class="mt-[9px]">
        <div
          class={`${COUNTDOWN_CLASS} gap-[7px] pt-[3px] pr-0 pb-[4px] pl-[11px] text-[24px] leading-[1.15] font-medium tracking-[-0.4px] ${COUNTDOWN_STATE_CLASS[fulltimeTimer.stateClass]}`}
        >
          <StateGlyph
            stateClass={fulltimeTimer.stateClass}
            className="size-[15px] flex-none"
            strokeWidth="2.2"
          />
          <span>{fulltimeTimer.text}</span>
        </div>
      </div>

      <div class="relative mt-3 h-1.5 overflow-hidden rounded-[2px] border border-rule bg-wash">
        <div
          class="h-full bg-ink transition-[width] duration-[900ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]"
          style={{ width: `${progressPercent.toFixed(1)}%` }}
        />
        {markerPercent === null ? null : (
          <div
            class="absolute top-0 bottom-0 w-[2px] bg-ink-faint"
            style={{ left: `${markerPercent.toFixed(1)}%` }}
          />
        )}
      </div>

      <WorkedLine
        dayEntries={activeToday?.dayEntries ?? null}
        now={new Date(now)}
        policy={policy}
        fulltimeDate={activeToday?.fulltime ?? null}
        translate={translate}
      />

      <div class="mt-3 flex items-center gap-2 border-t border-rule pt-[11px]">
        <span class={`${EYEBROW_CLASS} flex-none whitespace-nowrap`}>
          {translate("partTime")}
        </span>
        <span class="flex-none font-num text-[12px] font-semibold tabular-nums whitespace-nowrap text-ink-2 select-text">
          {activeToday ? formatTime(activeToday.checkout1) : "--:--"}
        </span>
        <div
          class={`${COUNTDOWN_CLASS} ml-auto min-w-0 gap-1.5 pl-[9px] text-[13px] font-medium tracking-[-0.2px] ${COUNTDOWN_STATE_CLASS[partTimeTimer.stateClass]}`}
        >
          <StateGlyph
            stateClass={partTimeTimer.stateClass}
            className="size-[13px] flex-none"
            strokeWidth="2.4"
          />
          <span>{partTimeTimer.text}</span>
        </div>
      </div>
    </section>
  );
}
