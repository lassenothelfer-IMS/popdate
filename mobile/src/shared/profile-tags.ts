/**
 * The interests and languages a profile can show, shared by the app, the mock
 * server and the Convex backend. Both are optional and picked from these lists,
 * so there is nothing to type and nothing to moderate. The names people read
 * are in `src/i18n/locales/profile.ts`.
 */

/** In the order they are offered. The first ones show at once, the rest behind "More". */
export const INTERESTS = [
  'hiking',
  'cooking',
  'travel',
  'music',
  'coffee',
  'film',
  'gym',
  'reading',
  'concerts',
  'skiing',
  'dogs',
  'photography',
  'bouldering',
  'running',
  'cycling',
  'swimming',
  'yoga',
  'football',
  'dancing',
  'baking',
  'wine',
  'gaming',
  'art',
  'museums',
  'boardGames',
  'markets',
  'festivals',
  'cats',
] as const;

export type InterestTag = (typeof INTERESTS)[number];

/** Switzerland's own first, then the ones most spoken here. */
export const LANGUAGES = [
  'de',
  'gsw',
  'en',
  'fr',
  'it',
  'es',
  'pt',
  'rm',
  'sq',
  'sr',
  'hr',
  'tr',
  'ar',
  'ru',
  'zh',
  'nl',
] as const;

export type LanguageTag = (typeof LANGUAGES)[number];

export const MAX_INTERESTS = 5;
export const MAX_LANGUAGES = 5;

/** Only tags from the list, each once, in the order picked, and no more than allowed. */
function cleanTags<T extends string>(values: unknown, known: readonly T[], max: number): T[] {
  if (!Array.isArray(values)) return [];
  const kept: T[] = [];
  for (const value of values) {
    if (kept.length >= max) break;
    if (known.includes(value as T) && !kept.includes(value as T)) kept.push(value as T);
  }
  return kept;
}

/** What may be saved or shown as someone's interests, whatever was sent or stored. */
export function cleanInterests(values: unknown): InterestTag[] {
  return cleanTags(values, INTERESTS, MAX_INTERESTS);
}

export function cleanLanguages(values: unknown): LanguageTag[] {
  return cleanTags(values, LANGUAGES, MAX_LANGUAGES);
}
