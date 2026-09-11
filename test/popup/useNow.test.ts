import { act, renderHook } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNow } from "../../src/popup/hooks/useNow.ts";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useNow", () => {
  it("does not tick while inactive", () => {
    const { result } = renderHook(() => useNow(1000, false));
    const first: number = result.current;
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(first);
  });

  it("ticks on the interval while active", () => {
    const { result } = renderHook(() => useNow(1000, true));
    const first: number = result.current;
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current).toBeGreaterThan(first);
  });

  it("stops ticking once it goes inactive", () => {
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useNow(1000, active),
      { initialProps: { active: true } },
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    rerender({ active: false });
    const frozen: number = result.current;
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(frozen);
  });
});
