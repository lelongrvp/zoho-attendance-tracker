import type { VNode } from "preact";
import type { Lang, ThemeMode } from "../../lib/types.ts";
import type { Translator } from "../../lib/i18n.ts";
import type { Freshness } from "../derive.ts";
import {
  MarkIcon,
  MoonIcon,
  RefreshIcon,
  SettingsIcon,
  SunIcon,
} from "./Icons.tsx";

const ACTION_CLASS: string =
  "grid size-[30px] flex-none cursor-pointer appearance-none place-items-center rounded-panel border border-rule-strong bg-transparent p-0 text-ink-2 transition-[background-color,color,border-color] duration-[160ms] ease-[ease] hover:border-ink-3 hover:bg-wash hover:text-ink active:bg-rule focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const ACTION_SPINNING_CLASS: string =
  "pointer-events-none border-ink bg-wash text-ink motion-reduce:opacity-[0.55]";
const GLYPH_CLASS: string = "block size-[15px]";

export type MastheadProps = {
  freshness: Freshness;
  lang: Lang;
  mode: ThemeMode;
  onOpenOptions: () => void;
  onRefresh: () => void;
  onToggleLang: () => void;
  onToggleTheme: () => void;
  refreshing: boolean;
  translate: Translator;
};

export function Masthead({
  freshness,
  lang,
  mode,
  onOpenOptions,
  onRefresh,
  onToggleLang,
  onToggleTheme,
  refreshing,
  translate,
}: MastheadProps): VNode {
  return (
    <header class="flex items-center gap-[10px] border-b border-b-ink pb-[11px]">
      <MarkIcon className="block size-[22px] flex-none" />
      <a
        class="group block text-inherit no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        href="https://people.zoho.com/"
        target="_blank"
        rel="noreferrer"
        title={translate("titleBrand")}
      >
        <span class="block text-[14px] leading-[1.15] font-[650] tracking-[-0.01em] group-hover:underline group-hover:underline-offset-2">
          Attendance
        </span>
        <span class="block text-[10px] leading-[1.4] font-medium tracking-[0.08em] text-ink-3 uppercase">
          Zoho People ·{" "}
          <span
            class={`font-num text-[9.5px] tracking-normal tabular-nums normal-case ${freshness.stale ? "text-stamp" : "text-ink-faint"}`}
          >
            {freshness.text}
          </span>
        </span>
      </a>
      <div class="ml-auto flex gap-[7px]">
        <button
          type="button"
          class={ACTION_CLASS}
          title={translate("titleLang")}
          aria-label={translate("titleLang")}
          onClick={onToggleLang}
        >
          <span class="font-num text-[10px] font-bold tracking-[0.04em]">
            {lang === "en" ? "VI" : "EN"}
          </span>
        </button>
        <button
          type="button"
          class={ACTION_CLASS}
          title={translate("titleSettings")}
          aria-label={translate("titleSettings")}
          onClick={onOpenOptions}
        >
          <SettingsIcon className={GLYPH_CLASS} />
        </button>
        <button
          type="button"
          class={ACTION_CLASS}
          title={translate("titleTheme")}
          aria-label={translate("titleTheme")}
          onClick={onToggleTheme}
        >
          {mode === "dark" ? (
            <SunIcon className={GLYPH_CLASS} />
          ) : (
            <MoonIcon className={GLYPH_CLASS} />
          )}
        </button>
        <button
          type="button"
          class={`${ACTION_CLASS} ${refreshing ? ACTION_SPINNING_CLASS : ""}`}
          title={translate("titleRefresh")}
          aria-label={translate("titleRefresh")}
          onClick={onRefresh}
        >
          <RefreshIcon
            className={`${GLYPH_CLASS} ${refreshing ? "animate-spin [animation-duration:750ms] motion-reduce:animate-none" : ""}`}
          />
        </button>
      </div>
    </header>
  );
}
