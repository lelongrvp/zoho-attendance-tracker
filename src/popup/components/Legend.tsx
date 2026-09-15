import type { VNode } from "preact";
import type { Translator } from "@/lib/i18n.ts";

type LegendEntry = { key: string; swatchClass: string };

const ENTRIES: LegendEntry[] = [
  { key: "legFull", swatchClass: "border-transparent bg-ink" },
  { key: "legShort", swatchClass: "border-transparent bg-ink-faint" },
  { key: "legLow", swatchClass: "border-transparent bg-stamp" },
  { key: "legLeave", swatchClass: "border-transparent bg-moss" },
  { key: "legAbsent", swatchClass: "border-stamp bg-stamp-tint" },
  {
    key: "legHoliday",
    swatchClass:
      "border-rule-strong bg-[repeating-linear-gradient(-45deg,var(--color-panel),var(--color-panel)_2px,var(--color-rule-strong)_2px,var(--color-rule-strong)_4px)]",
  },
  { key: "legWeekend", swatchClass: "border-rule bg-wash" },
  { key: "legRequest", swatchClass: "border-transparent bg-amber" },
  { key: "legNone", swatchClass: "border-rule bg-panel" },
];

export type LegendProps = { translate: Translator };

export function Legend({ translate }: LegendProps): VNode {
  return (
    <div class="mt-3 flex flex-wrap gap-x-3 gap-y-1.75">
      {ENTRIES.map((entry: LegendEntry): VNode => (
        <span
          key={entry.key}
          class="flex items-center gap-1.25 text-[9.5px] text-ink-3"
        >
          <i
            class={`block size-2.5 rounded-cell border ${entry.swatchClass}`}
          />
          <em class="not-italic">{translate(entry.key)}</em>
        </span>
      ))}
    </div>
  );
}
