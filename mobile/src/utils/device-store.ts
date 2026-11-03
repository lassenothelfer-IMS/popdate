import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Small JSON values kept on this device: the keychain on a phone, localStorage
 * on the web. The keychain takes about 2 KB per value, so longer values are
 * split across numbered keys.
 */
const CHUNK = 600; // characters: at most 1.8 KB even when every one takes 3 bytes

async function get(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function set(key: string, value: string) {
  if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
}

async function remove(key: string) {
  if (Platform.OS === 'web') globalThis.localStorage?.removeItem(key);
  else await SecureStore.deleteItemAsync(key);
}

/**
 * The last write or removal of each key. The next one waits for it, so two
 * writes of chunked values never interleave and leave a mix of both behind.
 */
const pending = new Map<string, Promise<void>>();

function inOrder(key: string, task: () => Promise<void>): Promise<void> {
  const run = (pending.get(key) ?? Promise.resolve()).then(task);
  pending.set(key, run);
  void run.then(() => {
    if (pending.get(key) === run) pending.delete(key);
  });
  return run;
}

/** The stored value, or null when there is none or it can't be read. */
export async function readJson<T>(key: string): Promise<T | null> {
  try {
    // A write still under way would be read half old, half new.
    await pending.get(key);
    const count = Number(await get(`${key}.count`));
    if (!count) return null;
    const parts = await Promise.all(Array.from({ length: count }, (_, i) => get(`${key}.${i}`)));
    if (parts.some((part) => part === null)) return null;
    return JSON.parse(parts.join('')) as T;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown) {
  return inOrder(key, () => write(key, value));
}

export function removeJson(key: string) {
  return inOrder(key, () => removeAll(key));
}

async function write(key: string, value: unknown) {
  try {
    const text = JSON.stringify(value);
    const count = Math.max(1, Math.ceil(text.length / CHUNK));
    const previous = Number(await get(`${key}.count`)) || 0;
    for (let i = 0; i < count; i++) await set(`${key}.${i}`, text.slice(i * CHUNK, (i + 1) * CHUNK));
    await set(`${key}.count`, String(count));
    for (let i = count; i < previous; i++) await remove(`${key}.${i}`);
  } catch {
    // Not kept: the next launch starts from scratch, as before.
  }
}

async function removeAll(key: string) {
  try {
    const count = Number(await get(`${key}.count`)) || 0;
    await remove(`${key}.count`);
    for (let i = 0; i < count; i++) await remove(`${key}.${i}`);
  } catch {
    // Nothing to clean up.
  }
}
