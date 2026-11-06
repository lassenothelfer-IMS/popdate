import { getLocales } from 'expo-localization';
import { I18n, type TranslateOptions } from 'i18n-js';
import { createContext, use, type ReactNode } from 'react';

import { balloons } from '@/i18n/locales/balloons';
import { chat } from '@/i18n/locales/chat';
import { common } from '@/i18n/locales/common';
import { game } from '@/i18n/locales/game';
import { home } from '@/i18n/locales/home';
import { howToPlay } from '@/i18n/locales/howToPlay';
import { match } from '@/i18n/locales/match';
import { onboarding } from '@/i18n/locales/onboarding';
import { profile } from '@/i18n/locales/profile';
import { queue } from '@/i18n/locales/queue';
import { almost, checkin, rooms, you } from '@/i18n/locales/rooms';
import { settings } from '@/i18n/locales/settings';
import { LOCALES, type Locale, type Strings } from '@/i18n/types';

/**
 * Every area registers under its own namespace, so a key reads like
 * `t('game.pickQuestion')` and two areas never collide.
 */
const AREAS = {
  balloons,
  chat,
  common,
  game,
  home,
  howToPlay,
  match,
  onboarding,
  profile,
  queue,
  rooms,
  settings,
  you,
  almost,
  checkin,
} satisfies Record<string, Strings>;

type Areas = typeof AREAS;
type English<A extends keyof Areas> = Areas[A]['en'];

/** Every key `t()` knows, like `'game.pickQuestion'`, read from the English strings. */
export type TranslationKey = {
  [A in keyof Areas]: `${A}.${keyof English<A> & string}`;
}[keyof Areas];

/** The keys whose English string is a plural (`{ one, other }`): they need a `count`. */
export type PluralKey = {
  [A in keyof Areas]: {
    [K in keyof English<A> & string]: English<A>[K] extends string ? never : `${A}.${K}`;
  }[keyof English<A> & string];
}[keyof Areas];

/** A plural key takes `{ count }`; any other key takes optional placeholders. */
type OptionsFor<K extends TranslationKey> = K extends PluralKey
  ? [options: TranslateOptions & { count: number }]
  : [options?: TranslateOptions];

const i18n = new I18n();
i18n.defaultLocale = 'en';
i18n.enableFallback = true;
for (const locale of LOCALES) {
  i18n.store({
    [locale]: Object.fromEntries(Object.entries(AREAS).map(([area, strings]) => [area, strings[locale]])),
  });
}

/** The phone's first supported language, or English. */
export function deviceLocale(): Locale {
  for (const { languageCode } of getLocales()) {
    if (languageCode && (LOCALES as readonly string[]).includes(languageCode)) {
      return languageCode as Locale;
    }
  }
  return 'en';
}

/** The phone's region, like 'CH', or null when it doesn't say. */
export function deviceRegion(): string | null {
  return getLocales()[0]?.regionCode ?? null;
}

export type Translate = <K extends TranslationKey>(key: K, ...options: OptionsFor<K>) => string;

const LocaleContext = createContext<Locale>('en');

/** Set by the settings provider; everything under it re-renders when the language changes. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

/** The current language. */
export function useLocale(): Locale {
  return use(LocaleContext);
}

/**
 * The translate function for the current language:
 * `t('home.play')`, `t('game.asks', { name })`, `t('game.balloonsLeft', { count })`.
 */
export function useT(): Translate {
  const locale = use(LocaleContext);
  return (key, ...[options]) => i18n.t(key, { locale, ...options });
}

/** Outside React (announcements in callbacks, the mock): translate in a given language. */
export function translate<K extends TranslationKey>(locale: Locale, key: K, ...[options]: OptionsFor<K>) {
  return i18n.t(key, { locale, ...options });
}
