import type { VNode } from "preact";
import type { Translator } from "../../lib/i18n.ts";

export type TabId = "attendance" | "calendar";

const TAB_BASE: string =
  "-mb-px cursor-pointer appearance-none border-b-2 bg-transparent px-0 pt-0 pb-[5px] font-ui text-[10.5px] font-semibold tracking-[0.09em] uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const TAB_ACTIVE: string = "border-b-ink text-ink";
const TAB_INACTIVE: string = "border-b-transparent text-ink-3";

export type TabsProps = {
  activeTab: TabId;
  onSelect: (tab: TabId) => void;
  translate: Translator;
};

export function Tabs({ activeTab, onSelect, translate }: TabsProps): VNode {
  return (
    <nav class="mt-2 flex gap-[18px] border-b border-rule-strong">
      <button
        type="button"
        class={`${TAB_BASE} ${activeTab === "attendance" ? TAB_ACTIVE : TAB_INACTIVE}`}
        onClick={(): void => onSelect("attendance")}
      >
        {translate("tabAttendance")}
      </button>
      <button
        type="button"
        class={`${TAB_BASE} ${activeTab === "calendar" ? TAB_ACTIVE : TAB_INACTIVE}`}
        onClick={(): void => onSelect("calendar")}
      >
        {translate("tabCalendar")}
      </button>
    </nav>
  );
}
