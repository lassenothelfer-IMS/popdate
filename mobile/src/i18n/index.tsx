import { getLocales } from 'expo-localization';
import { I18n, type TranslateOptions } from 'i18n-js';
import { createContext, use, type ReactNode } from 'react';

import { chat } from '@/i18n/locales/chat';
import { common } from '@/i18n/locales/common';
import { game } from '@/i18n/locales/game';
import { home } from '@/i18n/locales/home';
import { howToPlay } from '@/i18n/locales/howToPlay';
import { match } from '@/i18n/locales/match';
import { onboarding } from '@/i18n/locales/onboarding';
import { profile } from '@/i18n/locales/profile';
import { queue } from '@/i18n/locales/queue';
import { settings } from '@/i18n/locales/settings';
import { LOCALES, type Locale, type Strings } from '@/i18n/types';

/**
 * Every area registers under its own namespace, so a key reads like
 * `t('game.pickQuestion')` and two areas never collide.
 */
const AREAS: Record<string, Strings> = {
  chat,
  common,
  game,
  home,
  howToPlay,
  match,
  onboarding,
  profile,
  queue,
  settings,
};

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

export type Translate = (key: string, options?: TranslateOptions) => string;

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
  return (key, options) => i18n.t(key, { locale, ...options });
}

/** Outside React (announcements in callbacks, the mock): translate in a given language. */
export function translate(locale: Locale, key: string, options?: TranslateOptions) {
  return i18n.t(key, { locale, ...options });
}
