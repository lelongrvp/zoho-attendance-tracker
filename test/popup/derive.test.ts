import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY } from "../../src/lib/policy.ts";
import { makeTranslator } from "../../src/lib/i18n.ts";
import type { Translator } from "../../src/lib/i18n.ts";
import type { Policy, ZohoDay } from "../../src/lib/types.ts";
import type {
  CalendarCellState,
  HistoryBar,
  HistoryDay,
  TimerState,
} from "../../src/popup/derive.ts";
import {
  buildDayByKey,
  deriveAlert,
  deriveCalendarCells,
  deriveHistoryBars,
  deriveQuotaPillState,
  deriveSlotsToShow,
  deriveTimerState,
  shouldRequestBackgroundRefresh,
} from "../../src/popup/derive.ts";

const translate: Translator = makeTranslator("en");
const policy: Policy = DEFAULT_POLICY;

describe("deriveAlert", () => {
  it("shows login when there is no csrf token", () => {
    expect(deriveAlert(undefined, null, undefined)).toEqual({ kind: "login" });
  });

  it("shows the error when it is newer than the last success", () => {
    expect(deriveAlert("token", { message: "boom", at: 200 }, 100)).toEqual({
      kind: "error",
      message: "boom",
    });
  });

  it("hides when the last success is newer than the error", () => {
    expect(deriveAlert("token", { message: "boom", at: 100 }, 200)).toEqual({
      kind: "hidden",
    });
  });
});

describe("shouldRequestBackgroundRefresh", () => {
  it("refuses without a csrf token", () => {
    expect(shouldRequestBackgroundRefresh(undefined, undefined, false, 0)).toBe(
      false,
    );
  });

  it("refuses once already requested this open", () => {
    expect(shouldRequestBackgroundRefresh("token", undefined, true, 0)).toBe(
      false,
    );
  });

  it("refuses when data is fresh enough", () => {
    expect(
      shouldRequestBackgroundRefresh("token", 1000, false, 1000 + 60_000),
    ).toBe(false);
  });

  it("allows once data is stale past the auto-refresh window", () => {
    expect(
      shouldRequestBackgroundRefresh("token", 1000, false, 1000 + 6 * 60_000),
    ).toBe(true);
  });
});

describe("deriveQuotaPillState", () => {
  it("alerts when over quota", () => {
    expect(deriveQuotaPillState(4, 3, false)).toBe("alert");
  });

  it("alerts on any warning-quota count", () => {
    expect(deriveQuotaPillState(1, 3, true)).toBe("alert");
  });

  it("warns exactly at quota", () => {
    expect(deriveQuotaPillState(3, 3, false)).toBe("warn");
  });

  it("is active below quota", () => {
    expect(deriveQuotaPillState(1, 3, false)).toBe("active");
  });

  it("has no state at zero", () => {
    expect(deriveQuotaPillState(0, 3, false)).toBe("none");
  });
});

describe("deriveSlotsToShow", () => {
  it("shows one slot per overflow day", () => {
    expect(deriveSlotsToShow(5, 3)).toBe(5);
  });

  it("shows the full quota when under it", () => {
    expect(deriveSlotsToShow(1, 3)).toBe(3);
  });
});

describe("deriveTimerState", () => {
  it("is a placeholder without a target", () => {
    expect(deriveTimerState(null, null, policy, 0, translate)).toEqual({
      text: "--:--:--",
      stateClass: "time-active",
    });
  });

  it("counts down while the target is ahead", () => {
    const checkin: Date = new Date(2026, 0, 1, 9, 0, 0);
    const target: Date = new Date(2026, 0, 1, 17, 15, 0);
    const now: number = new Date(2026, 0, 1, 17, 0, 0).getTime();
    const state: TimerState = deriveTimerState(
      target,
      checkin,
      policy,
      now,
      translate,
    );
    expect(state.stateClass).toBe("time-active");
    expect(state.text).toContain("left");
  });

  it("is completed once the target passes, before the late threshold", () => {
    const checkin: Date = new Date(2026, 0, 1, 9, 0, 0);
    const target: Date = new Date(2026, 0, 1, 17, 15, 0);
    const now: number = new Date(2026, 0, 1, 17, 20, 0).getTime();
    expect(
      deriveTimerState(target, checkin, policy, now, translate).stateClass,
    ).toBe("time-completed");
  });

  it("is late once the target is past the 19:30 threshold", () => {
    const checkin: Date = new Date(2026, 0, 1, 9, 0, 0);
    const target: Date = new Date(2026, 0, 1, 20, 0, 0);
    const now: number = new Date(2026, 0, 1, 20, 5, 0).getTime();
    expect(
      deriveTimerState(target, checkin, policy, now, translate).stateClass,
    ).toBe("time-late");
  });
});

describe("deriveHistoryBars", () => {
  it("classifies empty, low, short and full days", () => {
    const days: HistoryDay[] = [
      { label: "a", tsecs: 0 },
      { label: "b", tsecs: 3 * 3600 },
      { label: "c", tsecs: 7 * 3600 },
      { label: "d", tsecs: 9 * 3600 },
    ];
    const bars: HistoryBar[] = deriveHistoryBars(days, policy, 9 * 3600);
    expect(bars.map((bar: HistoryBar): string => bar.kind)).toEqual([
      "empty",
      "low",
      "short",
      "none",
    ]);
  });
});

describe("deriveCalendarCells", () => {
  const start: Date = new Date(2026, 0, 1);
  const end: Date = new Date(2026, 0, 3);
  const todayKey: string = "2026-01-02";

  function cellsFor(days: Record<string, ZohoDay>): CalendarCellState[] {
    const dayByKey: Map<string, ZohoDay> = buildDayByKey(
      Object.values(days),
      start,
      end,
    );
    return deriveCalendarCells(
      start,
      end,
      dayByKey,
      todayKey,
      policy,
      "en",
      translate,
    );
  }

  it("prioritises leave over every hours bucket", () => {
    const cells: CalendarCellState[] = cellsFor({
      "2026-01-01": {
        orgdate: "2026-01-01",
        tsecs: policy.fullDaySeconds,
        leaveDaysTaken: 1,
      },
    });
    expect(cells[0]?.status).toBe("leave");
  });

  it("prioritises absent over a zero-hours off day", () => {
    const cells: CalendarCellState[] = cellsFor({
      "2026-01-01": { orgdate: "2026-01-01", tsecs: 0, status: "Absent" },
    });
    expect(cells[0]?.status).toBe("absent");
  });

  it("classifies a non-working status as holiday or weekend, not off", () => {
    const cells: CalendarCellState[] = cellsFor({
      "2026-01-01": { orgdate: "2026-01-01", tsecs: 0, status: "Weekend" },
    });
    expect(cells[0]?.status).toBe("weekend");
  });

  it("marks today independently of the status", () => {
    const cells: CalendarCellState[] = cellsFor({
      "2026-01-02": { orgdate: "2026-01-02", tsecs: policy.fullDaySeconds },
    });
    const today: CalendarCellState | undefined = cells.find(
      (cell: CalendarCellState): boolean => cell.key === todayKey,
    );
    expect(today?.isToday).toBe(true);
    expect(today?.status).toBe("full");
  });

  it("marks a request as an overlay, not a replacement of the status", () => {
    const cells: CalendarCellState[] = cellsFor({
      "2026-01-01": {
        orgdate: "2026-01-01",
        tsecs: policy.fullDaySeconds,
        approvalInfo: [{ reason: "test" }],
      },
    });
    expect(cells[0]?.status).toBe("full");
    expect(cells[0]?.hasRequest).toBe(true);
  });
});
