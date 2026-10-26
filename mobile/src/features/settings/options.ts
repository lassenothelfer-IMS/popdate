import type { LanguageSetting } from '@/api';
import type { Translate } from '@/i18n';

/** Each language is named in itself, so you can find yours whatever the app is set to. */
export const LANGUAGES: { value: Exclude<LanguageSetting, 'system'>; name: string }[] = [
  { value: 'en', name: 'English' },
  { value: 'de', name: 'Deutsch' },
  { value: 'fr', name: 'Français' },
  { value: 'it', name: 'Italiano' },
];

/** The regions Popdate launches in. Anywhere else is saved as `ZZ`, the ISO code for "unknown". */
export const REGIONS = ['CH', 'DE', 'AT', 'FR', 'IT', 'GB', 'US'] as const;
export const OTHER_REGION = 'ZZ';

export function languageName(language: LanguageSetting, t: Translate) {
  if (language === 'system') return t('settings.languageSystem');
  return LANGUAGES.find((option) => option.value === language)?.name ?? language;
}

/** A region's name in the app's language; one outside the list reads as "Other". */
export function regionName(code: string, t: Translate) {
  return (REGIONS as readonly string[]).includes(code)
    ? t(`settings.region${code}`)
    : t('settings.regionOther');
}

/** The Region row's value: your choice, or "Follow phone" with what the phone says. */
export function regionSettingLabel(setting: string | null, phoneRegion: string | null, t: Translate) {
  if (setting) return regionName(setting, t);
  return phoneRegion
    ? t('settings.regionPhoneWith', { region: regionName(phoneRegion, t) })
    : t('settings.regionPhone');
}
