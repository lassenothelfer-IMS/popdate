import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { LOCALES, type StringTable, type Strings } from '@/i18n/types';

/**
 * Every string table in `locales/`, found by reading the folder, so a new
 * area is checked without being added here.
 */
const dir = join(__dirname, 'locales');
const files = readdirSync(dir)
  .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
  .map((file) => file.slice(0, -'.ts'.length));

const areas: [string, Strings][] = [];
for (const file of files) {
  const module = (await import(`./locales/${file}.ts`)) as Record<string, unknown>;
  for (const [name, value] of Object.entries(module)) {
    if (value && typeof value === 'object' && 'en' in value) areas.push([name, value as Strings]);
  }
}

/** A string's `%{name}` placeholders, sorted. */
function placeholders(text: string) {
  return [...text.matchAll(/%\{(\w+)\}/g)].map((m) => m[1]).sort();
}

/** Plural or not, and the placeholders, of each string. */
function shapeOf(table: StringTable) {
  return Object.fromEntries(
    Object.entries(table).map(([key, value]) => [
      key,
      typeof value === 'string'
        ? { plural: null, placeholders: placeholders(value) }
        : {
            plural: Object.keys(value).sort(),
            placeholders: [...new Set([...placeholders(value.one), ...placeholders(value.other)])].sort(),
          },
    ]),
  );
}

describe('locales', () => {
  it('finds the string tables', () => {
    expect(areas.length).toBeGreaterThanOrEqual(files.length);
  });

  describe.each(areas)('%s', (_name, strings) => {
    it('has all four languages', () => {
      expect(Object.keys(strings).sort()).toEqual([...LOCALES].sort());
    });

    it.each(LOCALES.filter((locale) => locale !== 'en'))('%s has the same keys as English', (locale) => {
      expect(Object.keys(strings[locale]).sort()).toEqual(Object.keys(strings.en).sort());
    });

    it.each(LOCALES.filter((locale) => locale !== 'en'))('%s keeps the plurals of English', (locale) => {
      const plurals = (table: StringTable) =>
        Object.fromEntries(Object.entries(shapeOf(table)).map(([key, shape]) => [key, shape.plural]));
      expect(plurals(strings[locale])).toEqual(plurals(strings.en));
    });

    // A translation may leave a name out ("your chat" for "your chat with %{name}"),
    // but one English doesn't fill in would show up as a literal %{...}.
    it.each(LOCALES.filter((locale) => locale !== 'en'))('%s only uses placeholders English has', (locale) => {
      const english = shapeOf(strings.en);
      for (const [key, shape] of Object.entries(shapeOf(strings[locale]))) {
        for (const name of shape.placeholders) {
          expect(english[key]?.placeholders, `${locale}.${key} uses %{${name}}`).toContain(name);
        }
      }
    });

    // i18n-js only fills in %{name}; a {{name}} would reach the screen as written.
    it('uses no {{...}} placeholders', () => {
      for (const locale of LOCALES) {
        for (const [key, value] of Object.entries(strings[locale])) {
          const texts = typeof value === 'string' ? [value] : [value.one, value.other];
          for (const text of texts) expect(text, `${locale}.${key}`).not.toMatch(/\{\{/);
        }
      }
    });

    it('has no empty strings', () => {
      for (const locale of LOCALES) {
        for (const [key, value] of Object.entries(strings[locale])) {
          const texts = typeof value === 'string' ? [value] : [value.one, value.other];
          for (const text of texts) expect(text.trim(), `${locale}.${key}`).not.toBe('');
        }
      }
    });
  });
});
