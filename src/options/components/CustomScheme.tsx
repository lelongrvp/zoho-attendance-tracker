import type { TargetedInputEvent, VNode } from "preact";
import type { Scheme, SchemeColors, ThemeMode } from "../../lib/types.ts";
import { COLOR_KEYS } from "../form.ts";

type CustomSchemeProps = {
  scheme: Scheme;
  onChange: (scheme: Scheme) => void;
};

const LABELS: Record<string, string> = {
  paper: "paper",
  panel: "panel",
  ink: "ink",
  stamp: "red",
  moss: "green",
  amber: "yellow",
};

/** Six colour inputs per mode; borders and tints are derived from them. */
export function CustomScheme({ scheme, onChange }: CustomSchemeProps): VNode {
  const setColor = (mode: ThemeMode, key: keyof SchemeColors, value: string): void => {
    onChange({ ...scheme, [mode]: { ...scheme[mode], [key]: value } });
  };

  return (
    <div class="border-b border-rule pt-[10px] pb-[2px]">
      <p class="mb-2 text-[11px] text-ink-3">
        Custom scheme — six colors per mode; borders, tints and muted text are
        derived from these.
      </p>
      {(["light", "dark"] as ThemeMode[]).map(
        (mode: ThemeMode): VNode => (
          <div key={mode} class="flex items-center gap-[10px] py-1">
            <span class="w-10 text-[10px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
              {mode}
            </span>
            {COLOR_KEYS.map(
              (key: keyof SchemeColors): VNode => (
                <label
                  key={key}
                  class="flex flex-col items-center gap-[3px] text-[9.5px] text-ink-faint"
                >
                  {LABELS[key] ?? key}
                  <input
                    type="color"
                    class="h-[26px] w-10 cursor-pointer rounded-[3px] border border-rule-strong bg-panel p-px"
                    value={scheme[mode][key] ?? "#000000"}
                    onInput={(event: TargetedInputEvent<HTMLInputElement>): void =>
                      setColor(mode, key, event.currentTarget.value)
                    }
                  />
                </label>
              ),
            )}
          </div>
        ),
      )}
    </div>
  );
}
