import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import { BackButton } from '@/features/onboarding/back-button';
import { goBackOr, SETTINGS_PAGE } from '@/features/settings/settings-ui';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

const TIPS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/** A short editorial page: numbered habits, each a serif title and one or two plain lines. */
export function SafetyTipsScreen() {
  const t = useT();
  const theme = useTheme();
  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(SETTINGS_PAGE)} />
      <ThemedText type="display" accessibilityRole="header" style={styles.title}>
        {t('settings.safetyTips')}
      </ThemedText>
      <ThemedText type="callout" themeColor="textSecondary" style={styles.intro}>
        {t('settings.tipsIntro')}
      </ThemedText>

      <View style={styles.list}>
        {TIPS.map((n, index) => (
          <View
            key={n}
            accessible
            style={[
              styles.tip,
              { borderBottomColor: theme.border },
              index === TIPS.length - 1 && styles.lastTip,
            ]}>
            <ThemedText type="headline" themeColor="textTertiary" style={styles.number}>
              {String(n).padStart(2, '0')}
            </ThemedText>
            <View style={styles.tipText}>
              <ThemedText type="quote" maxFontSizeMultiplier={1.6}>
                {t(`settings.tip${n}Title`)}
              </ThemedText>
              <ThemedText type="callout" themeColor="textSecondary">
                {t(`settings.tip${n}Body`)}
              </ThemedText>
            </View>
          </View>
        ))}
      </View>

      <ThemedText type="footnote" themeColor="textSecondary" style={styles.emergency}>
        {t('settings.tipsEmergency')}
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: Space.md,
  },
  intro: {
    marginTop: 10,
  },
  list: {
    marginTop: Space.lg,
  },
  tip: {
    flexDirection: 'row',
    gap: Space.md,
    paddingVertical: Space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastTip: {
    borderBottomWidth: 0,
  },
  // Sits on the title's first line.
  number: {
    width: 22,
    paddingTop: 4,
    fontVariant: ['tabular-nums'],
  },
  tipText: {
    flex: 1,
    gap: Space.xxs,
  },
  emergency: {
    marginTop: Space.md,
  },
});
