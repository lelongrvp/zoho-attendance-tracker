import type { VNode } from "preact";
import type { Translator } from "../../lib/i18n.ts";
import type { CalendarCellState } from "../derive.ts";
import { CalendarCell } from "./CalendarCell.tsx";

const WEEKDAY_KEYS: string[] = [
  "wdMon",
  "wdTue",
  "wdWed",
  "wdThu",
  "wdFri",
  "wdSat",
  "wdSun",
];

export type CalendarGridProps = {
  cells: CalendarCellState[];
  leadingSpacers: number;
  translate: Translator;
};

export function CalendarGrid({
  cells,
  leadingSpacers,
  translate,
}: CalendarGridProps): VNode {
  return (
    <>
      <div class="mt-1.5 grid grid-cols-7 gap-[3px]">
        {WEEKDAY_KEYS.map((key: string): VNode => (
          <span
            key={key}
            class="text-center text-[9px] tracking-[0.06em] text-ink-faint uppercase"
          >
            {translate(key)}
          </span>
        ))}
      </div>
      <div class="mt-[5px] grid grid-cols-7 gap-[3px]">
        {Array.from({ length: leadingSpacers }, (_, index: number): VNode => (
          <div
            key={`spacer-${index}`}
            class="h-[34px] rounded-cell border-none bg-transparent"
          />
        ))}
        {cells.map((cell: CalendarCellState): VNode => (
          <CalendarCell
            key={cell.key}
            dateNum={cell.dateNum}
            status={cell.status}
            hasRequest={cell.hasRequest}
            isToday={cell.isToday}
            title={cell.title}
          />
        ))}
      </div>
    </>
  );
}
