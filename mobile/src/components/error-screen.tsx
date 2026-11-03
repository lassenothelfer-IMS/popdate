import { useEffect } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import { deviceLocale, translate, type TranslationKey } from '@/i18n';
import { useOptionalSettings } from '@/state/settings';
import { captureError } from '@/utils/analytics';

type ErrorScreenProps = {
  error: Error;
  /** Renders the screen that broke again. */
  retry: () => void;
};

/**
 * What a crash shows instead of a blank app: a calm line and Try again. It can
 * sit above every provider, so it reads your language from the settings when
 * they are there and from the phone when they aren't.
 */
export function ErrorScreen({ error, retry }: ErrorScreenProps) {
  const locale = useOptionalSettings()?.locale ?? deviceLocale();
  const t = (key: TranslationKey) => translate(locale, key);

  useEffect(() => {
    captureError(error, { where: 'error-screen' });
  }, [error]);

  return (
    <Screen scroll contentStyle={styles.page}>
      <ThemedText type="title" accessibilityRole="header" style={styles.text}>
        {t('common.errorScreenTitle')}
      </ThemedText>
      <ThemedText type="callout" themeColor="textSecondary" style={styles.text}>
        {t('common.errorScreenBody')}
      </ThemedText>
      <Button title={t('common.tryAgain')} fullWidth={false} onPress={retry} style={styles.button} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Space.sm,
  },
  text: {
    textAlign: 'center',
  },
  button: {
    marginTop: Space.md,
  },
});
