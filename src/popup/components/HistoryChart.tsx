import type { VNode } from "preact";
import type {
  HistoryBar,
  HistoryBarKind,
  HistoryDay,
  HistoryRefLine,
} from "../derive.ts";
import {
  deriveHistoryBars,
  deriveHistoryRefLines,
  deriveHistoryScale,
} from "../derive.ts";
import type { Policy } from "../../lib/types.ts";

const BAR_KIND_CLASS: Record<HistoryBarKind, string> = {
  none: "bg-ink",
  short: "bg-ink-faint",
  low: "bg-stamp",
  empty: "bg-rule",
};

export type HistoryChartProps = {
  cycleDays: HistoryDay[];
  policy: Policy;
};

export function HistoryChart({ cycleDays, policy }: HistoryChartProps): VNode {
  if (cycleDays.length === 0) {
    return <div class="relative mt-1.5 flex h-8 items-end gap-0.5" />;
  }

  const scaleSeconds: number = deriveHistoryScale(
    cycleDays,
    policy.fullDaySeconds,
  );
  const refLines: HistoryRefLine[] = deriveHistoryRefLines(
    policy,
    scaleSeconds,
  );
  const bars: HistoryBar[] = deriveHistoryBars(cycleDays, policy, scaleSeconds);

  return (
    <div class="relative mt-1.5 flex h-8 items-end gap-0.5">
      {refLines.map((line: HistoryRefLine, index: number): VNode => (
        <div
          key={index}
          class="pointer-events-none absolute inset-x-0 border-t border-dashed border-rule-strong"
          style={{ bottom: `${line.bottomPercent.toFixed(1)}%` }}
        />
      ))}
      {bars.map((bar: HistoryBar, index: number): VNode => (
        <div
          key={index}
          title={`${bar.label} · ${(bar.tsecs / 3600).toFixed(1)}h`}
          class={`relative min-w-0 flex-1 rounded-t-[1px] ${BAR_KIND_CLASS[bar.kind]}`}
          style={{ height: `${bar.heightPercent}%` }}
        />
      ))}
    </div>
  );
}
