import { render } from "preact";
import { App } from "./App.tsx";
import "../styles/app.css";
import type { Scheme, ThemeMode } from "../lib/types.ts";
import { read } from "../lib/storage.ts";
import { applyTokens, resolveTokens } from "../lib/themes.ts";

/** Paint the real palette before first frame; the effect would be one frame late. */
const stored: Partial<{
  theme: ThemeMode;
  scheme: string;
  customScheme: Scheme;
}> = await read(["theme", "scheme", "customScheme"]);

const mode: ThemeMode =
  stored.theme === "dark" || stored.theme === "light"
    ? stored.theme
    : window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";

document.documentElement.dataset["theme"] = mode;
applyTokens(
  document.documentElement,
  resolveTokens(stored.scheme ?? "gruvbox", mode, stored.customScheme ?? null),
);

const root: HTMLElement | null = document.getElementById("root");
if (root) {
  render(<App />, root);
}
