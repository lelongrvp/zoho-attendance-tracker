import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { TodayCard } from "@/popup/components/TodayCard.tsx";
import { makeTranslator } from "@/lib/i18n.ts";
import { DEFAULT_POLICY } from "@/lib/policy.ts";
import type { Translator } from "@/lib/i18n.ts";
import type { ActiveToday } from "@/popup/derive.ts";

afterEach((): void => {
  cleanup();
});

const translate: Translator = makeTranslator("en");

function makeActiveToday(checkinHour: number): ActiveToday {
  const checkin: Date = new Date(2026, 0, 5, checkinHour, 0, 0);
  return {
    checkin,
    isFromYesterday: false,
    checkout1: new Date(2026, 0, 5, checkinHour + 4, 30, 0),
    fulltime: new Date(2026, 0, 5, checkinHour + 9, 0, 0),
    dayEntries: null,
  };
}

describe("TodayCard", () => {
  it("shows the no-record state with pending timers and a zero-width bar", () => {
    const { container } = render(
      <TodayCard
        activeToday={null}
        now={new Date(2026, 0, 5, 10, 0, 0).getTime()}
        policy={DEFAULT_POLICY}
        translate={translate}
      />,
    );
    expect(container.textContent).toContain("No record today");
    expect(container.querySelectorAll("svg").length).toBe(0);
    const bar: HTMLElement | null = container.querySelector(".bg-ink");
    expect(bar?.style.width).toBe("0.0%");
  });

  it("hides the part-time marker when there is no active check-in", () => {
    const { container } = render(
      <TodayCard
        activeToday={null}
        now={Date.now()}
        policy={DEFAULT_POLICY}
        translate={translate}
      />,
    );
    expect(container.querySelector(".bg-ink-faint")).toBeNull();
  });

  it("places the part-time marker between check-in and full-time", () => {
    const { container } = render(
      <TodayCard
        activeToday={makeActiveToday(8)}
        now={new Date(2026, 0, 5, 10, 0, 0).getTime()}
        policy={DEFAULT_POLICY}
        translate={translate}
      />,
    );
    const marker: HTMLElement | null = container.querySelector(".bg-ink-faint");
    expect(marker?.style.left).toBe("50.0%");
  });

  it("fills the bar proportionally to elapsed time", () => {
    const { container } = render(
      <TodayCard
        activeToday={makeActiveToday(8)}
        now={new Date(2026, 0, 5, 12, 30, 0).getTime()}
        policy={DEFAULT_POLICY}
        translate={translate}
      />,
    );
    const bar: HTMLElement | null = container.querySelector(".bg-ink");
    expect(bar?.style.width).toBe("50.0%");
  });

  it("caps the bar at full once the full-time target has passed", () => {
    const { container } = render(
      <TodayCard
        activeToday={makeActiveToday(8)}
        now={new Date(2026, 0, 5, 23, 0, 0).getTime()}
        policy={DEFAULT_POLICY}
        translate={translate}
      />,
    );
    const bar: HTMLElement | null = container.querySelector(".bg-ink");
    expect(bar?.style.width).toBe("100.0%");
  });
});
