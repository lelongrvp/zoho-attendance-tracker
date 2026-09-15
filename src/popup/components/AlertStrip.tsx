import type { VNode } from "preact";
import type { Translator } from "@/lib/i18n.ts";
import type { AlertState } from "@/popup/derive.ts";
import { WarningIcon } from "./Icons.tsx";

const LINK_CLASS: string =
  "border-b border-b-[rgba(166,58,34,0.45)] font-semibold text-stamp no-underline hover:border-b-stamp focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp";

function LoginPrompt({ translate }: { translate: Translator }): VNode {
  const parts: string[] = translate("loginPrompt").split("{link}");
  return (
    <>
      {parts[0] ?? ""}
      <a
        class={LINK_CLASS}
        href="https://people.zoho.com/"
        target="_blank"
        rel="noreferrer"
      >
        Zoho People
      </a>
      {parts[1] ?? ""}
    </>
  );
}

export type AlertStripProps = {
  state: AlertState;
  translate: Translator;
};

export function AlertStrip({
  state,
  translate,
}: AlertStripProps): VNode | null {
  if (state.kind === "hidden") {
    return null;
  }
  return (
    <div class="mt-2.75 flex items-start gap-2.25 rounded-panel border-y border-r border-l-[3px] border-y-stamp-line border-r-stamp-line border-l-stamp bg-stamp-tint px-2.75 py-2.5">
      <WarningIcon className="mt-px size-3.75 flex-none text-stamp" />
      <span class="min-w-0 text-[12px] leading-[1.45] text-stamp-text wrap-anywhere">
        {state.kind === "login" ? (
          <LoginPrompt translate={translate} />
        ) : (
          state.message
        )}
      </span>
    </div>
  );
}
