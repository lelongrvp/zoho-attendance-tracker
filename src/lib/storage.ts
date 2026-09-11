import type { StorageShape, StorageKey } from "./types.ts";

// chrome.storage.local typed against StorageShape. Every read and write in the
// extension goes through here, which is the only thing that makes the shape
// worth declaring - a call site that reaches for chrome.storage directly gets
// `any` back and the type becomes decorative.
//
// Values are all optional on read: the store starts empty on a fresh install,
// and a key the worker has not written yet is undefined rather than a default.

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
  const stored = (await chrome.storage.local.get(key)) as Partial<
    Pick<StorageShape, K>
  >;
  return stored[key];
}

export async function write(values: Partial<StorageShape>): Promise<void> {
  await chrome.storage.local.set(values);
}

export async function remove(keys: StorageKey | StorageKey[]): Promise<void> {
  await chrome.storage.local.remove(keys);
}

/**
 * A change record for one key, as `chrome.storage.onChanged` delivers it.
 * Typed per key so a listener narrowing on `changes.attendanceData` gets the
 * real shape rather than `any`.
 */
export type StorageChanges = {
  [K in StorageKey]?: { oldValue?: StorageShape[K]; newValue?: StorageShape[K] };
};

export function onLocalChange(
  handle: (changes: StorageChanges) => void,
): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") {
      return;
    }
    handle(changes as StorageChanges);
  });
}
