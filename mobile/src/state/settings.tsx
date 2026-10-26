import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { api, type Settings } from '@/api';
import { deviceLocale, deviceRegion, LocaleProvider } from '@/i18n';
import type { Locale } from '@/i18n/types';
import { useSession } from '@/state/session';
import { maskProfanity } from '@/utils/profanity';

export const DEFAULT_SETTINGS: Settings = {
  language: 'system',
  region: null,
  units: 'metric',
  appearance: 'system',
  commentFilter: true,
  notifications: { roomLive: true, newMatch: true, messages: true },
};

type SettingsState = {
  settings: Settings;
  /** The language in use: your choice, or the phone's when you chose `system`. */
  locale: Locale;
  /** The region in use, like 'CH'. */
  region: string | null;
  /** Saves a change. The app uses it at once; a failed save rolls it back and throws. */
  update: (change: Partial<Settings>) => Promise<void>;
};

const SettingsContext = createContext<SettingsState | null>(null);

/**
 * Your settings, loaded from the server once you're signed in, and applied
 * app-wide: the language (through the locale provider) and the appearance
 * (read by useScheme).
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { ready, profile } = useSession();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const accountId = profile?.id ?? null;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    api.getSettings().then(
      (loaded) => {
        if (!cancelled) setSettings(loaded);
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
    // A new or deleted account brings its own settings.
  }, [ready, accountId]);

  async function update(change: Partial<Settings>) {
    const previous = settings;
    const next = { ...settings, ...change };
    setSettings(next);
    try {
      setSettings(await api.saveSettings(next));
    } catch (error) {
      setSettings(previous);
      throw error;
    }
  }

  const locale = settings.language === 'system' ? deviceLocale() : settings.language;
  const region = settings.region ?? deviceRegion();

  return (
    <SettingsContext value={{ settings, locale, region, update }}>
      <LocaleProvider locale={locale}>{children}</LocaleProvider>
    </SettingsContext>
  );
}

export function useSettings() {
  const state = use(SettingsContext);
  if (!state) throw new Error('useSettings must be used inside SettingsProvider.');
  return state;
}

/** Settings without the provider, for the few places above it. Falls back to the defaults. */
export function useOptionalSettings(): SettingsState | null {
  return use(SettingsContext);
}

/** Applies your comment filter to someone else's words: offensive words become bullets when it's on. */
export function useFilterText(): (text: string) => string {
  const filterOn = use(SettingsContext)?.settings.commentFilter ?? true;
  return (text) => (filterOn ? maskProfanity(text) : text);
}
