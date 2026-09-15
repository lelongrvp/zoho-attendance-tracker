import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { CalendarGrid } from "../../src/popup/components/CalendarGrid.tsx";
import { makeTranslator } from "../../src/lib/i18n.ts";
import type { Translator } from "../../src/lib/i18n.ts";
import type { CalendarCellState } from "../../src/popup/derive.ts";

afterEach((): void => {
  cleanup();
});

const translate: Translator = makeTranslator("en");

describe("CalendarGrid", () => {
  it("renders spacers before day cells, as one flat sibling list", () => {
    const cells: CalendarCellState[] = [
      {
        key: "2026-01-01",
        dateNum: 1,
        status: "full",
        hasRequest: false,
        isToday: false,
        title: "",
      },
      {
        key: "2026-01-02",
        dateNum: 2,
        status: "off",
        hasRequest: false,
        isToday: false,
        title: "",
      },
    ];
    const { container } = render(
      <CalendarGrid cells={cells} leadingSpacers={3} translate={translate} />,
    );
    const dayGrid: Element | null =
      container.querySelectorAll(".grid")[1] ?? null;
    expect(dayGrid).not.toBeNull();
    const children: Element[] = [...(dayGrid?.children ?? [])];
    expect(children.length).toBe(5);
    expect(
      children.slice(0, 3).every((child) => child.textContent === ""),
    ).toBe(true);
    expect(children[3]?.textContent).toBe("1");
    expect(children[4]?.textContent).toBe("2");
  });

  it("renders zero spacers when the cycle starts on a Monday", () => {
    const cells: CalendarCellState[] = [
      {
        key: "2026-01-05",
        dateNum: 5,
        status: "off",
        hasRequest: false,
        isToday: false,
        title: "",
      },
    ];
    const { container } = render(
      <CalendarGrid cells={cells} leadingSpacers={0} translate={translate} />,
    );
    const dayGrid: Element | null =
      container.querySelectorAll(".grid")[1] ?? null;
    expect(dayGrid?.children.length).toBe(1);
  });

  it("renders the seven weekday headers", () => {
    const { container } = render(
      <CalendarGrid cells={[]} leadingSpacers={0} translate={translate} />,
    );
    const weekdayGrid: Element | null =
      container.querySelectorAll(".grid")[0] ?? null;
    expect(weekdayGrid?.children.length).toBe(7);
  });
});
