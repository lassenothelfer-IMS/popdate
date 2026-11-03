import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Gutter, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deviceLocale, translate } from '@/i18n';

/**
 * What shows when a screen throws while rendering. It replaces the whole app, so
 * the session and settings are gone here: it reads the phone's language, and keeps
 * to the theme's default look.
 */
export function CrashScreen({ retry }: ErrorBoundaryProps) {
  const theme = useTheme();
  const [locale] = useState(deviceLocale);

  // A crash on the very first render happens under the splash.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <View style={[styles.page, { backgroundColor: theme.page }]}>
      <ThemedText accessibilityRole="alert" style={styles.message}>
        {translate(locale, 'common.somethingWrong')}
      </ThemedText>
      <Button title={translate(locale, 'common.tryAgain')} onPress={() => void retry()} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: 'center',
    gap: Space.lg,
    paddingHorizontal: Gutter,
  },
  message: {
    textAlign: 'center',
  },
});
