import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { QuotaRow } from "@/popup/components/QuotaRow.tsx";
import type { QuotaRecord } from "@/popup/derive.ts";

afterEach((): void => {
  cleanup();
});

describe("QuotaRow", () => {
  it("shows one slot per overflow day, past the quota", () => {
    const records: QuotaRecord[] = [
      { label: "a", hours: "8.5" },
      { label: "b", hours: "9.0" },
      { label: "c", hours: "7.0" },
    ];
    const { container } = render(
      <QuotaRow
        name="Days 6-8 hours"
        count={3}
        totalSlots={2}
        isWarning={false}
        warnRow
        records={records}
      />,
    );
    const slots: NodeListOf<Element> = container.querySelectorAll(".grid");
    expect(slots.length).toBe(3);
  });

  it("marks the overflow slot with the stamp colour, not the ink colour", () => {
    const records: QuotaRecord[] = [
      { label: "a", hours: "8.5" },
      { label: "b", hours: "9.0" },
    ];
    const { container } = render(
      <QuotaRow
        name="Days 6-8 hours"
        count={2}
        totalSlots={1}
        isWarning={false}
        warnRow
        records={records}
      />,
    );
    const slots: Element[] = [...container.querySelectorAll(".grid")];
    expect(slots[0]?.className).toContain("border-ink");
    expect(slots[1]?.className).toContain("border-stamp");
  });

  it("shows the count pill text", () => {
    const { getByText } = render(
      <QuotaRow
        name="Attendance requests"
        count={1}
        totalSlots={3}
        isWarning={false}
        warnRow={false}
        records={[]}
      />,
    );
    expect(getByText("1/3")).toBeTruthy();
  });

  it("does not render the warning glyph on a non-warn row", () => {
    const { container } = render(
      <QuotaRow
        name="Attendance requests"
        count={0}
        totalSlots={3}
        isWarning={false}
        warnRow={false}
        records={[]}
      />,
    );
    expect(container.querySelectorAll("svg").length).toBe(0);
  });
});
