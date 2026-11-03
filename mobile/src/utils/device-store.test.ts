import { beforeEach, describe, expect, it, vi } from 'vitest';

/** The keychain, as a plain map. */
const keychain = vi.hoisted(() => new Map<string, string>());

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => keychain.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => void keychain.set(key, value),
  deleteItemAsync: async (key: string) => void keychain.delete(key),
}));

const { readJson, removeJson, writeJson } = await import('@/utils/device-store');

beforeEach(() => keychain.clear());

describe('device-store', () => {
  it('reads back what it wrote', async () => {
    await writeJson('test', { name: 'Lena', photos: [1, 2, 3] });
    expect(await readJson('test')).toEqual({ name: 'Lena', photos: [1, 2, 3] });
  });

  it('gives null for a key it never wrote', async () => {
    expect(await readJson('missing')).toBeNull();
  });

  it('splits long values across keys and joins them again', async () => {
    const value = { text: 'ä'.repeat(2000) };
    await writeJson('long', value);
    expect(Number(keychain.get('long.count'))).toBeGreaterThan(1);
    for (const [key, part] of keychain) {
      if (key !== 'long.count') expect(part.length).toBeLessThanOrEqual(600);
    }
    expect(await readJson('long')).toEqual(value);
  });

  it('drops the extra parts when a value gets shorter', async () => {
    await writeJson('shrink', 'x'.repeat(2000));
    await writeJson('shrink', 'short');
    expect([...keychain.keys()].sort()).toEqual(['shrink.0', 'shrink.count']);
    expect(await readJson('shrink')).toBe('short');
  });

  it('removes every part', async () => {
    await writeJson('gone', 'x'.repeat(2000));
    await removeJson('gone');
    expect(keychain.size).toBe(0);
    expect(await readJson('gone')).toBeNull();
  });

  it('keeps writes to one key in order', async () => {
    const first = writeJson('race', 'a'.repeat(3000));
    const second = writeJson('race', 'b'.repeat(10));
    await Promise.all([first, second]);
    expect(await readJson('race')).toBe('b'.repeat(10));
  });

  it('gives null when a part is missing', async () => {
    await writeJson('broken', 'x'.repeat(2000));
    keychain.delete('broken.1');
    expect(await readJson('broken')).toBeNull();
  });
});
