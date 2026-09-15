import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { Masthead } from "@/popup/components/Masthead.tsx";
import { makeTranslator } from "@/lib/i18n.ts";
import type { Translator } from "@/lib/i18n.ts";
import type { MastheadProps } from "@/popup/components/Masthead.tsx";

afterEach((): void => {
  cleanup();
});

const translate: Translator = makeTranslator("en");

function renderMasthead(overrides: Partial<MastheadProps>): Element {
  const props: MastheadProps = {
    freshness: { text: "Updated 2m ago", stale: false },
    lang: "en",
    mode: "light",
    onOpenOptions: (): void => {},
    onRefresh: (): void => {},
    onToggleLang: (): void => {},
    onToggleTheme: (): void => {},
    refreshing: false,
    translate,
    ...overrides,
  };
  return render(<Masthead {...props} />).container;
}

describe("Masthead", () => {
  it("labels the language button with the language it switches to", () => {
    expect(renderMasthead({ lang: "en" }).textContent).toContain("VI");
    cleanup();
    expect(renderMasthead({ lang: "vi" }).textContent).toContain("EN");
  });

  it("shows the moon in light mode and the sun in dark mode", () => {
    const light: Element = renderMasthead({ mode: "light" });
    const lightGlyph: Element | undefined = light.querySelectorAll("button")[2];
    expect(lightGlyph?.querySelectorAll("circle").length).toBe(0);
    cleanup();
    const dark: Element = renderMasthead({ mode: "dark" });
    const darkGlyph: Element | undefined = dark.querySelectorAll("button")[2];
    expect(darkGlyph?.querySelectorAll("circle").length).toBe(1);
  });

  it("marks stale freshness with the stamp colour", () => {
    const fresh: Element = renderMasthead({
      freshness: { text: "Updated 2m ago", stale: false },
    });
    expect(fresh.querySelector(".text-ink-faint")?.textContent).toBe(
      "Updated 2m ago",
    );
    cleanup();
    const stale: Element = renderMasthead({
      freshness: { text: "Never updated", stale: true },
    });
    expect(stale.querySelector(".text-stamp")?.textContent).toBe(
      "Never updated",
    );
  });

  it("spins and disables the refresh button only while refreshing", () => {
    const idle: Element = renderMasthead({ refreshing: false });
    expect(idle.querySelectorAll(".animate-spin").length).toBe(0);
    cleanup();
    const busy: Element = renderMasthead({ refreshing: true });
    expect(busy.querySelectorAll(".animate-spin").length).toBe(1);
    expect(busy.querySelectorAll(".pointer-events-none").length).toBe(1);
  });

  it("fires each action handler from its own button", () => {
    const onToggleLang: Mock = vi.fn();
    const onOpenOptions: Mock = vi.fn();
    const onToggleTheme: Mock = vi.fn();
    const onRefresh: Mock = vi.fn();
    const container: Element = renderMasthead({
      onToggleLang,
      onOpenOptions,
      onToggleTheme,
      onRefresh,
    });
    const buttons: NodeListOf<HTMLButtonElement> =
      container.querySelectorAll("button");
    expect(buttons.length).toBe(4);
    for (const button of buttons) button.click();
    expect(onToggleLang).toHaveBeenCalledTimes(1);
    expect(onOpenOptions).toHaveBeenCalledTimes(1);
    expect(onToggleTheme).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("titles every control from the translation table", () => {
    const container: Element = renderMasthead({});
    const titles: string[] = [...container.querySelectorAll("[title]")].map(
      (element: Element): string => element.getAttribute("title") ?? "",
    );
    expect(titles).toEqual([
      "Open Zoho People",
      "Chuyển sang tiếng Việt",
      "Settings",
      "Switch between light and dark",
      "Refresh attendance data",
    ]);
  });
});
