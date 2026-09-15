import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY, workingFraction } from "@/lib/policy.ts";
import { makeTranslator } from "@/lib/i18n.ts";
import type { Translator } from "@/lib/i18n.ts";
import type { Policy, ZohoDay } from "@/lib/types.ts";
import type {
  CycleUsageDerived,
  CalendarCellState,
  HistoryBar,
  HistoryDay,
  TimerState,
} from "@/popup/derive.ts";
import {
  deriveCycleUsage,
  buildDayByKey,
  deriveAlert,
  deriveCalendarCells,
  deriveHistoryBars,
  deriveQuotaPillState,
  deriveSlotsToShow,
  deriveTimerState,
  shouldRequestBackgroundRefresh,
} from "@/popup/derive.ts";

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
      { label: "a", tsecs: 0, fraction: 1 },
      { label: "b", tsecs: 3 * 3600, fraction: 1 },
      { label: "c", tsecs: 7 * 3600, fraction: 1 },
      { label: "d", tsecs: 9 * 3600, fraction: 1 },
    ];
    const bars: HistoryBar[] = deriveHistoryBars(days, policy, 9 * 3600);
    expect(bars.map((bar: HistoryBar): string => bar.kind)).toEqual([
      "empty",
      "low",
      "short",
      "none",
    ]);
  });

  it("measures a part-leave day against its own reduced bars", () => {
    // 7h46m on a 0.25-leave day met the 6h owed, so the bar is not a short one.
    const days: HistoryDay[] = [
      { label: "quarter-leave", tsecs: 27960, fraction: 0.75 },
      { label: "same hours, no leave", tsecs: 27960, fraction: 1 },
    ];
    const bars: HistoryBar[] = deriveHistoryBars(days, policy, 9 * 3600);
    expect(bars.map((bar: HistoryBar): string => bar.kind)).toEqual([
      "none",
      "short",
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

  it("classifies a part-leave day by its hours, not as leave", () => {
    // 0.25 day leave and 7h46m worked: it clears the pro-rated 6h bar, so it is
    // a full day. Painting it as leave was how the bug showed on the calendar.
    const cells: CalendarCellState[] = cellsFor({
      "2026-01-01": {
        orgdate: "2026-01-01",
        tsecs: 27960,
        leaveDaysTaken: 0.25,
        status: "0.25 day Paid Leave(Annual Leave$1$), 0.75 day Present",
      },
    });
    expect(cells[0]?.status).toBe("full");
  });

  it("calls a part-leave day short when it misses the pro-rated bar", () => {
    const cells: CalendarCellState[] = cellsFor({
      "2026-01-01": {
        orgdate: "2026-01-01",
        tsecs: 5 * 3600,
        leaveDaysTaken: 0.25,
      },
    });
    expect(cells[0]?.status).toBe("short");
  });

  it("keeps a part-leave day with no hours as leave", () => {
    const cells: CalendarCellState[] = cellsFor({
      "2026-01-01": { orgdate: "2026-01-01", tsecs: 0, leaveDaysTaken: 0.5 },
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

describe("partial-leave days", () => {
  const cycleDay = (
    orgdate: string,
    tsecs: number,
    leaveDaysTaken: number,
    status: string = "",
  ): ZohoDay => ({ orgdate, tsecs, leaveDaysTaken, status });

  // The real 2026-09-15 payload: 0.25 day annual leave, 7h46m worked.
  const QUARTER_LEAVE_DAY: ZohoDay = cycleDay(
    "2026-09-15",
    27960,
    0.25,
    "0.25 day Paid Leave(Annual Leave$1$), 0.75 day Present",
  );

  it("owes only the worked fraction of a day", (): void => {
    expect(workingFraction(QUARTER_LEAVE_DAY)).toBe(0.75);
    expect(workingFraction(cycleDay("2026-09-16", 0, 0.5))).toBe(0.5);
    expect(workingFraction(cycleDay("2026-09-17", 28800, 0))).toBe(1);
    expect(workingFraction(cycleDay("2026-09-18", 0, 1))).toBe(0);
  });

  it("clamps nonsense leave values into 0..1", (): void => {
    expect(workingFraction(cycleDay("2026-09-19", 0, 1.5))).toBe(0);
    expect(workingFraction(cycleDay("2026-09-20", 0, -1))).toBe(1);
    expect(workingFraction(null)).toBe(1);
  });

  it("counts 7h46m on a 0.25-leave day as a full day, not a short one", (): void => {
    const policy: Policy = DEFAULT_POLICY;
    const fraction: number = workingFraction(QUARTER_LEAVE_DAY);
    // 7h46m clears the pro-rated 6h bar, but not the whole-day 8h bar.
    expect(27960).toBeGreaterThanOrEqual(policy.fullDaySeconds * fraction);
    expect(27960).toBeLessThan(policy.fullDaySeconds);
  });

  it("keeps a full leave day as leave, and a half day with no hours too", (): void => {
    expect(workingFraction(cycleDay("2026-09-21", 0, 1))).toBe(0);
    const halfDayNoHours: ZohoDay = cycleDay("2026-09-22", 0, 0.5);
    expect(workingFraction(halfDayNoHours)).toBe(0.5);
    expect(Number(halfDayNoHours.tsecs)).toBe(0);
  });
});

describe("deriveCycleUsage with a part-leave day", () => {
  // Cycle 21 Aug - 20 Sep. Five ordinary short days, plus the real 2026-09-15:
  // 0.25 day annual leave and 7h46m worked, which used to make the quota 6/5.
  const dayList: Record<string, ZohoDay> = {
    0: { orgdate: "2026-09-08", tsecs: 6.0 * 3600 },
    1: { orgdate: "2026-09-09", tsecs: 6.6 * 3600 },
    2: { orgdate: "2026-09-10", tsecs: 6.2 * 3600 },
    3: { orgdate: "2026-09-11", tsecs: 6.1 * 3600 },
    4: { orgdate: "2026-09-14", tsecs: 6.7 * 3600 },
    5: {
      orgdate: "2026-09-15",
      tsecs: 27960,
      leaveDaysTaken: 0.25,
      status: "0.25 day Paid Leave(Annual Leave$1$), 0.75 day Present",
    },
  };
  const now: Date = new Date(2026, 8, 16, 12, 0, 0);
  const usage: CycleUsageDerived = deriveCycleUsage(
    dayList,
    now,
    DEFAULT_POLICY,
    "en",
  );

  it("does not count the part-leave day against the 6-8h quota", (): void => {
    expect(usage.days6To8Hours).toHaveLength(5);
    expect(usage.days6To8Hours.map((r) => r.hours)).not.toContain("7.8");
  });

  it("charges only 0.75 of a day against the balance", (): void => {
    // five short days owe 8h each, the part-leave day owes 6h.
    const owed: number = 5 * 8 * 3600 + 0.75 * 8 * 3600;
    const worked: number = (6.0 + 6.6 + 6.2 + 6.1 + 6.7) * 3600 + 27960;
    expect(usage.balanceSeconds).toBeCloseTo(worked - owed, 5);
  });

  it("still tallies the leave itself", (): void => {
    expect(usage.leaveUsed).toBe(0.25);
    expect(usage.workedDays).toBe(6);
  });
});

describe("part-leave days across the hours range", () => {
  const usageFor = (tsecs: number, leaveDaysTaken: number): CycleUsageDerived =>
    deriveCycleUsage(
      { 0: { orgdate: "2026-09-15", tsecs, leaveDaysTaken } },
      new Date(2026, 8, 16, 12, 0, 0),
      DEFAULT_POLICY,
      "en",
    );

  it("quarter-day leave plus exactly 6h is a full day, owing nothing", () => {
    const usage: CycleUsageDerived = usageFor(6 * 3600, 0.25);
    expect(usage.days6To8Hours).toHaveLength(0);
    expect(usage.daysBelow6Hours).toHaveLength(0);
    expect(usage.balanceSeconds).toBe(0);
  });

  it("half-day leave plus 6h is a full day, two hours to the good", () => {
    const usage: CycleUsageDerived = usageFor(6 * 3600, 0.5);
    expect(usage.days6To8Hours).toHaveLength(0);
    expect(usage.balanceSeconds).toBe(2 * 3600);
  });

  it("half-day leave plus 3h is short of the 4h owed", () => {
    const usage: CycleUsageDerived = usageFor(3 * 3600, 0.5);
    expect(usage.days6To8Hours).toHaveLength(1);
    expect(usage.daysBelow6Hours).toHaveLength(0);
    expect(usage.balanceSeconds).toBe(-3600);
  });

  it("quarter-day leave plus 4h misses even the pro-rated short bar", () => {
    const usage: CycleUsageDerived = usageFor(4 * 3600, 0.25);
    expect(usage.daysBelow6Hours).toHaveLength(1);
    expect(usage.days6To8Hours).toHaveLength(0);
  });

  it("working on a whole leave day owes nothing and hits no quota", () => {
    const usage: CycleUsageDerived = usageFor(2 * 3600, 1);
    expect(usage.days6To8Hours).toHaveLength(0);
    expect(usage.daysBelow6Hours).toHaveLength(0);
    expect(usage.balanceSeconds).toBe(2 * 3600);
  });
});
