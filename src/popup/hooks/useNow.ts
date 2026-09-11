import { useEffect, useState } from "preact/hooks";

export function useNow(intervalMs: number, active: boolean): number {
  const [now, setNow] = useState<number>((): number => Date.now());

  useEffect((): (() => void) | void => {
    if (!active) {
      return;
    }
    setNow(Date.now());
    const id: ReturnType<typeof setInterval> = setInterval((): void => {
      setNow(Date.now());
    }, intervalMs);
    return (): void => clearInterval(id);
  }, [active, intervalMs]);

  return now;
}
