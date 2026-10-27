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

/** The stored value, or null when there is none or it can't be read. */
export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const count = Number(await get(`${key}.count`));
    if (!count) return null;
    const parts = await Promise.all(Array.from({ length: count }, (_, i) => get(`${key}.${i}`)));
    if (parts.some((part) => part === null)) return null;
    return JSON.parse(parts.join('')) as T;
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown) {
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

export async function removeJson(key: string) {
  try {
    const count = Number(await get(`${key}.count`)) || 0;
    await remove(`${key}.count`);
    for (let i = 0; i < count; i++) await remove(`${key}.${i}`);
  } catch {
    // Nothing to clean up.
  }
}
