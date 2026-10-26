import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

/**
 * How many rooms you have played, stored on this device only. Hints such as
 * "Swipe through the five" show during your first 3 rooms and hide from room 4.
 */
const KEY = 'popdate.roomsPlayed';
/** Hints show while you have played fewer rooms than this. */
export const HINT_ROOMS = 3;

let count: number | null = null;
const listeners = new Set<() => void>();

async function read(): Promise<number> {
  try {
    const raw =
      Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    const value = Number(raw ?? 0);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

async function write(value: number) {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, String(value));
    else await SecureStore.setItemAsync(KEY, String(value));
  } catch {
    // A lost count only means a hint shows a little longer.
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (count === null) {
    void read().then((value) => {
      count = value;
      emit();
    });
  }
  return () => listeners.delete(listener);
}

/** Count one more room, once it has ended for you (you left, popped or matched). */
export async function countRoomPlayed() {
  const current = count ?? (await read());
  count = current + 1;
  emit();
  await write(count);
}

/** Whether first-rooms hints should show. True until the count has loaded, then false from room 4. */
export function useShowHints(): boolean {
  const value = useSyncExternalStore(subscribe, () => count, () => count);
  return value === null || value < HINT_ROOMS;
}
