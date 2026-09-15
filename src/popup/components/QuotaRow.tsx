import type { VNode } from "preact";
import type { QuotaPillState, QuotaRecord } from "@/popup/derive.ts";
import { deriveQuotaPillState, deriveSlotsToShow } from "@/popup/derive.ts";
import { CheckIcon, WarningIcon } from "./Icons.tsx";

const PILL_CLASS: Record<QuotaPillState, string> = {
  none: "text-ink-3 bg-transparent border-rule-strong",
  active: "text-ink bg-wash border-ink-3",
  warn: "text-on-amber bg-amber border-amber",
  alert: "text-on-stamp bg-stamp border-stamp",
};

export type QuotaRowProps = {
  name: string;
  count: number;
  totalSlots: number;
  isWarning: boolean;
  warnRow: boolean;
  records: QuotaRecord[];
};

function slotTitle(record: QuotaRecord | undefined): string | undefined {
  if (!record) {
    return undefined;
  }
  return [
    record.label,
    record.hours === undefined ? null : `${record.hours}h`,
    record.note,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function QuotaRow({
  name,
  count,
  totalSlots,
  isWarning,
  warnRow,
  records,
}: QuotaRowProps): VNode {
  const slotsToShow: number = deriveSlotsToShow(count, totalSlots);
  const pillState: QuotaPillState = deriveQuotaPillState(
    count,
    totalSlots,
    isWarning,
  );
  const flagged: boolean = warnRow && pillState === "alert";

  return (
    <div class="border-b border-rule py-2">
      <div class="flex items-center gap-2.5">
        {warnRow ? (
          <WarningIcon
            className={`size-3 flex-none -mr-1 transition-colors duration-200 ${
              flagged ? "text-stamp" : "text-ink-faint"
            }`}
            strokeWidth="2.4"
          />
        ) : null}
        <span
          class={`text-[12.5px] font-medium whitespace-nowrap ${flagged ? "text-stamp" : "text-ink"}`}
        >
          {name}
        </span>
        <div class="ml-auto flex flex-none items-center gap-1.25">
          {Array.from({ length: slotsToShow }, (_, index: number): VNode => {
            const filled: boolean = index < count;
            const over: boolean = index >= totalSlots;
            return (
              <div
                key={index}
                title={slotTitle(records[index])}
                class={
                  "grid size-3.75 place-items-center rounded-cell border " +
                  (filled
                    ? over || isWarning
                      ? "border-stamp bg-stamp text-on-stamp"
                      : "border-ink bg-ink text-paper"
                    : "border-rule-strong bg-panel text-transparent")
                }
              >
                {filled ? <CheckIcon className="size-2.5" /> : null}
              </div>
            );
          })}
          <span
            class={`ml-1 rounded-cell border px-1.25 py-0.5 font-num text-[10px] tabular-nums leading-tight whitespace-nowrap ${PILL_CLASS[pillState]}`}
          >
            {count}/{totalSlots}
          </span>
        </div>
      </div>
    </div>
  );
}
