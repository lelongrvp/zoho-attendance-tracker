import type { VNode } from "preact";
import type { CalendarCellStatus } from "../derive.ts";

const CELL_BASE: string =
  "grid h-[34px] place-items-center rounded-cell font-num text-[11px] tabular-nums";

type ColorSet = { bg: string; border: string; text: string };

const STATUS_COLOR: Record<CalendarCellStatus, ColorSet> = {
  leave: { bg: "bg-moss", border: "border-moss", text: "text-paper" },
  absent: {
    bg: "bg-stamp-tint",
    border: "border-stamp",
    text: "text-stamp-text",
  },
  full: { bg: "bg-ink", border: "border-ink", text: "text-paper" },
  short: { bg: "bg-ink-faint", border: "border-ink-faint", text: "text-paper" },
  low: { bg: "bg-stamp", border: "border-stamp", text: "text-on-stamp" },
  holiday: { bg: "hatch", border: "border-rule-strong", text: "text-ink-2" },
  weekend: { bg: "bg-wash", border: "border-rule", text: "text-ink-faint" },
  future: {
    bg: "bg-transparent",
    border: "border-rule",
    text: "text-ink-faint",
  },
  off: { bg: "bg-panel", border: "border-rule", text: "text-ink-faint" },
};

const REQUEST_COLOR: ColorSet = {
  bg: "bg-amber",
  border: "border-amber",
  text: "text-on-amber",
};

export type CalendarCellProps = {
  dateNum: number;
  status: CalendarCellStatus;
  hasRequest: boolean;
  isToday: boolean;
  title: string;
};

export function CalendarCell({
  dateNum,
  status,
  hasRequest,
  isToday,
  title,
}: CalendarCellProps): VNode {
  const color: ColorSet = hasRequest ? REQUEST_COLOR : STATUS_COLOR[status];
  const borderColor: string = isToday
    ? hasRequest
      ? "border-on-amber"
      : "border-amber"
    : hasRequest
      ? "border-amber"
      : color.border;
  const ring: string = isToday
    ? hasRequest
      ? "shadow-[inset_0_0_0_1.5px_var(--color-on-amber)]"
      : "shadow-[inset_0_0_0_1.5px_var(--color-amber)]"
    : "";

  return (
    <div
      data-cal-cell="date"
      title={title}
      class={`${CELL_BASE} border ${status === "future" ? "border-dashed" : ""} ${color.bg} ${color.text} ${borderColor} ${ring}`}
    >
      {dateNum}
    </div>
  );
}
