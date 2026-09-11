import { useEffect } from "preact/hooks";
import type { Scheme, ThemeMode } from "../../lib/types.ts";
import { applyTokens, resolveTokens } from "../../lib/themes.ts";
import { write } from "../../lib/storage.ts";

function resolveSystemTheme(): ThemeMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export type Appearance = { mode: ThemeMode; toggleTheme: () => void };

export function useAppearance(
  theme: ThemeMode | undefined,
  schemeId: string | undefined,
  customScheme: Scheme | undefined,
): Appearance {
  const mode: ThemeMode = theme ?? resolveSystemTheme();

  useEffect((): void => {
    document.documentElement.dataset["theme"] = mode;
    applyTokens(
      document.documentElement,
      resolveTokens(schemeId ?? "gruvbox", mode, customScheme ?? null),
    );
  }, [mode, schemeId, customScheme]);

  function toggleTheme(): void {
    void write({ theme: mode === "dark" ? "light" : "dark" });
  }

  return { mode, toggleTheme };
}
