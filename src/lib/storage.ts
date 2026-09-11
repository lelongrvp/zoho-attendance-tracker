import type { StorageShape, StorageKey } from "./types.ts";

// chrome.storage.local typed against StorageShape.

export async function read<K extends StorageKey>(
  keys: K[],
): Promise<Partial<Pick<StorageShape, K>>> {
  return (await chrome.storage.local.get(keys)) as Partial<
    Pick<StorageShape, K>
  >;
}

export async function readOne<K extends StorageKey>(
  key: K,
): Promise<StorageShape[K] | undefined> {
  const stored: Partial<Pick<StorageShape, K>> =
    (await chrome.storage.local.get(key)) as Partial<Pick<StorageShape, K>>;
  return stored[key];
}

export async function write(values: Partial<StorageShape>): Promise<void> {
  await chrome.storage.local.set(values);
}

export async function remove(keys: StorageKey | StorageKey[]): Promise<void> {
  await chrome.storage.local.remove(keys);
}

// A change record for one key, as `chrome.storage.onChanged` delivers it.
export type StorageChanges = {
  [K in StorageKey]?: {
    oldValue?: StorageShape[K];
    newValue?: StorageShape[K];
  };
};

export type StorageChangeListener = (
  changes: { [key: string]: chrome.storage.StorageChange },
  area: string,
) => void;

export function onLocalChange(
  handle: (changes: StorageChanges) => void,
): StorageChangeListener {
  const listener: StorageChangeListener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: string,
  ): void => {
    if (area !== "local") {
      return;
    }
    handle(changes as StorageChanges);
  };
  chrome.storage.onChanged.addListener(listener);
  return listener;
}
