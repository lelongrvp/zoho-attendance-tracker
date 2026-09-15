import type { VNode } from "preact";
import type { Translator } from "@/lib/i18n.ts";
import type { Lang, Policy, ZohoDay } from "@/lib/types.ts";
import type { CycleUsageDerived } from "@/popup/derive.ts";
import { deriveCycleUsage } from "@/popup/derive.ts";
import { formatSignedHours } from "@/popup/format.ts";
import { QuotaRow } from "./QuotaRow.tsx";
import { HistoryChart } from "./HistoryChart.tsx";

export type CycleUsageProps = {
  dayList: Record<string, ZohoDay>;
  now: Date;
  policy: Policy;
  lang: Lang;
  translate: Translator;
};

export function CycleUsage({
  dayList,
  now,
  policy,
  lang,
  translate,
}: CycleUsageProps): VNode {
  const usage: CycleUsageDerived = deriveCycleUsage(dayList, now, policy, lang);

  return (
    <>
      <div class="mt-4 flex items-baseline gap-2.5 border-b border-ink pb-1.75">
        <h2 class="text-[11px] font-bold tracking-widest text-ink uppercase">
          {translate("cycleQuotas")}
        </h2>
        <span class="ml-auto font-num text-[10px] tracking-[0.02em] whitespace-nowrap text-ink-3">
          {usage.label}
        </span>
      </div>

      <QuotaRow
        name={translate("quotaShort")}
        count={usage.days6To8Hours.length}
        totalSlots={policy.shortDayQuota}
        isWarning={false}
        warnRow
        records={usage.days6To8Hours}
      />

      <QuotaRow
        name={translate("quotaRequests")}
        count={usage.requestDays.length}
        totalSlots={policy.requestQuota}
        isWarning={false}
        warnRow={false}
        records={usage.requestDays}
      />

      <QuotaRow
        name={translate("quotaViolation")}
        count={usage.daysBelow6Hours.length}
        totalSlots={policy.violationQuota}
        isWarning
        warnRow
        records={usage.daysBelow6Hours}
      />

      <div class="mt-2 border-t border-rule pt-2">
        <span class="text-[10px] font-semibold tracking-[0.09em] text-ink-3 uppercase">
          {translate("dailyHours")}
        </span>
        <HistoryChart cycleDays={usage.cycleDays} policy={policy} />
      </div>

      <div class="flex items-baseline gap-3 pt-2.25">
        <div class="flex items-baseline gap-1.75">
          <span class="text-[10px] font-semibold tracking-[0.09em] text-ink-3 uppercase">
            {translate("leaveDays")}
          </span>
          <span class="font-num text-[13px] font-semibold tabular-nums text-ink">
            {usage.leaveUsed}d
          </span>
        </div>
        <div class="ml-auto flex items-baseline gap-1.75">
          <span class="text-[10px] font-semibold tracking-[0.09em] text-ink-3 uppercase">
            {translate("absent")}
          </span>
          <span class="font-num text-[13px] font-semibold tabular-nums text-ink">
            {usage.absentCount}d
          </span>
        </div>
        <div class="ml-auto flex items-baseline gap-1.75">
          <span class="text-[10px] font-semibold tracking-[0.09em] text-ink-3 uppercase">
            {translate("balance")}
          </span>
          <span
            class={`font-num text-[13px] font-semibold tabular-nums ${
              usage.workedDays > 0 && usage.balanceSeconds < 0
                ? "text-stamp"
                : "text-ink"
            }`}
            title={
              usage.workedDays === 0
                ? ""
                : `${(usage.workedSeconds / 3600).toFixed(1)}h across ${usage.workedDays} recorded days`
            }
          >
            {usage.workedDays === 0
              ? "—"
              : formatSignedHours(usage.balanceSeconds)}
          </span>
        </div>
      </div>
    </>
  );
}
