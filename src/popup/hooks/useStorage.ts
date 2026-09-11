import { useEffect, useState } from "preact/hooks";
import type {
  StorageChanges,
  StorageChangeListener,
} from "../../lib/storage.ts";
import { onLocalChange, read } from "../../lib/storage.ts";
import type { StorageKey, StorageShape } from "../../lib/types.ts";

export function useStorage<K extends StorageKey>(
  keys: readonly K[],
): Partial<Pick<StorageShape, K>> | null {
  const [state, setState] = useState<Partial<Pick<StorageShape, K>> | null>(
    null,
  );

  useEffect((): (() => void) => {
    let cancelled: boolean = false;

    void read([...keys]).then(
      (initial: Partial<Pick<StorageShape, K>>): void => {
        if (!cancelled) {
          setState(initial);
        }
      },
    );

    const listener: StorageChangeListener = onLocalChange(
      (changes: StorageChanges): void => {
        const patch: Partial<Pick<StorageShape, K>> = {};
        let changed: boolean = false;
        for (const key of keys) {
          const change: StorageChanges[K] = changes[key];
          if (change) {
            patch[key] = change.newValue as StorageShape[K];
            changed = true;
          }
        }
        if (changed) {
          setState(
            (
              previous: Partial<Pick<StorageShape, K>> | null,
            ): Partial<Pick<StorageShape, K>> => ({ ...previous, ...patch }),
          );
        }
      },
    );

    return (): void => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

  return state;
}
