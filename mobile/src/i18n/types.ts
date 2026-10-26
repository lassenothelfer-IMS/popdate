export const LOCALES = ['en', 'de', 'fr', 'it'] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * One area's strings. Keys are flat camelCase names; values may hold
 * `%{name}` placeholders, and plural strings are objects with `one` and `other`
 * (use `%{count}` inside them). English is the source; a missing translation
 * falls back to English.
 */
export type StringTable = Record<string, string | { one: string; other: string }>;

export type Strings = Record<Locale, StringTable>;
