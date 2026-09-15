import type { VNode } from "preact";
import type { Translator } from "@/lib/i18n.ts";
import type { Policy, ZohoEntry } from "@/lib/types.ts";
import type { WorkedLineState } from "@/popup/derive.ts";
import { deriveWorkedLine } from "@/popup/derive.ts";

export type WorkedLineProps = {
  dayEntries: ZohoEntry[] | null;
  now: Date;
  policy: Policy;
  fulltimeDate: Date | null;
  translate: Translator;
};

export function WorkedLine({
  dayEntries,
  now,
  policy,
  fulltimeDate,
  translate,
}: WorkedLineProps): VNode {
  const state: WorkedLineState | null = deriveWorkedLine(
    dayEntries,
    now,
    policy,
    fulltimeDate,
    translate,
  );

  return (
    <div
      class={`mt-2 min-h-3.5 font-num text-[10.5px] tabular-nums ${
        state?.diverges ? "text-stamp" : "text-ink-3"
      }`}
      title={state?.tooltip ?? ""}
    >
      {state?.text ?? ""}
    </div>
  );
}
