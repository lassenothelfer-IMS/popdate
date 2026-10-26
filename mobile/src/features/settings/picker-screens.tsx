import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import type { Settings } from '@/api';
import { ErrorLine } from '@/components/error-line';
import { OptionRow } from '@/components/option-row';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import { BackButton } from '@/features/onboarding/back-button';
import { LANGUAGES, OTHER_REGION, REGIONS, regionName } from '@/features/settings/options';
import { goBackOr, SETTINGS_PAGE } from '@/features/settings/settings-ui';
import { deviceRegion, useT } from '@/i18n';
import { useSettings } from '@/state/settings';
import { haptics } from '@/utils/haptics';

type Option = { key: string; label: string; selected: boolean; change: Partial<Settings> };

/** One setting as a page of radio rows. A choice applies at once; Back returns to Settings. */
function PickerScreen({ title, options }: { title: string; options: Option[] }) {
  const t = useT();
  const { update } = useSettings();
  const [error, setError] = useState<string | null>(null);

  async function choose(option: Option) {
    if (option.selected) return;
    setError(null);
    try {
      await update(option.change);
    } catch {
      const message = t('common.somethingWrong');
      setError(message);
      haptics.error();
      AccessibilityInfo.announceForAccessibility(message);
    }
  }

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(SETTINGS_PAGE)} />
      <ThemedText type="display" accessibilityRole="header" style={styles.title}>
        {title}
      </ThemedText>
      <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel={title}>
        {options.map((option) => (
          <OptionRow
            key={option.key}
            label={option.label}
            selected={option.selected}
            onPress={() => choose(option)}
          />
        ))}
      </View>
      {error ? (
        <View style={styles.error}>
          <ErrorLine message={error} />
        </View>
      ) : null}
    </Screen>
  );
}

export function LanguageScreen() {
  const t = useT();
  const { settings } = useSettings();
  const options: Option[] = [
    {
      key: 'system',
      label: t('settings.languageSystem'),
      selected: settings.language === 'system',
      change: { language: 'system' },
    },
    ...LANGUAGES.map(({ value, name }) => ({
      key: value,
      label: name,
      selected: settings.language === value,
      change: { language: value },
    })),
  ];
  return <PickerScreen title={t('settings.language')} options={options} />;
}

export function RegionScreen() {
  const t = useT();
  const { settings } = useSettings();
  const phone = deviceRegion();
  const chosen = settings.region;
  const isListed = (code: string | null) => !!code && (REGIONS as readonly string[]).includes(code);
  const options: Option[] = [
    {
      key: 'phone',
      label: phone
        ? t('settings.regionPhoneWith', { region: regionName(phone, t) })
        : t('settings.regionPhone'),
      selected: chosen === null,
      change: { region: null },
    },
    ...REGIONS.map((code) => ({
      key: code,
      label: regionName(code, t),
      selected: chosen === code,
      change: { region: code },
    })),
    {
      key: OTHER_REGION,
      label: t('settings.regionOther'),
      selected: chosen !== null && !isListed(chosen),
      change: { region: OTHER_REGION },
    },
  ];
  return <PickerScreen title={t('settings.region')} options={options} />;
}

const styles = StyleSheet.create({
  title: {
    marginTop: Space.md,
  },
  options: {
    gap: Space.xs,
    marginTop: Space.lg,
  },
  error: {
    marginTop: Space.sm,
  },
});
