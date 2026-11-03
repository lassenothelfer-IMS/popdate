import type { Translate } from '@/i18n';

/** The counts that have a word: `match.n0` to `match.n10`. */
type Spelled = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** Counts up to ten are spelled out, as in "Swipe through all four"; past that, digits. */
export function numberWord(t: Translate, value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 10
    ? t(`match.n${value as Spelled}`)
    : String(value);
}
