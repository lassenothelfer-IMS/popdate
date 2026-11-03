import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Rise } from '@/components/rise';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import { INTRO } from '@/features/how-to-play/step-art';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/** A sheet opened from Home, or a page reached some other way: either way, back to where you were. */
function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/home');
}

/**
 * The rules again, from Home: onboarding's three "How it works" cards (S02 to
 * S04) one under the other, then one line for each role.
 */
export function HowToPlayScreen() {
  const theme = useTheme();
  const t = useT();
  return (
    <Screen scroll footerStyle="plain" footer={<Button title={t('howToPlay.gotIt')} onPress={close} />}>
      <View style={styles.top}>
        <Button title={t('common.close')} variant="plain" fullWidth={false} onPress={close} />
      </View>

      <Rise index={0}>
        <ThemedText type="title" accessibilityRole="header">
          {t('howToPlay.title')}
        </ThemedText>
      </Rise>

      {INTRO.map(({ key, Art, title, body }, i) => (
        <Rise key={key} index={i + 1} style={styles.step}>
          <Art />
          <View
            accessible
            accessibilityLabel={t('howToPlay.stepLabel', {
              number: i + 1,
              total: INTRO.length,
              text: `${t(title)} ${t(body)}`,
            })}
            style={styles.caption}>
            <ThemedText type="display">{t(title)}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.body}>
              {t(body)}
            </ThemedText>
          </View>
        </Rise>
      ))}

      <Rise index={INTRO.length + 1} style={[styles.roles, { borderTopColor: theme.border }]}>
        <View style={styles.role}>
          <ThemedText type="headline" accessibilityRole="header">
            {t('howToPlay.choosingTitle')}
          </ThemedText>
          <ThemedText type="callout" themeColor="textSecondary">
            {t('howToPlay.choosingBody')}
          </ThemedText>
        </View>
        <View style={styles.role}>
          <ThemedText type="headline" accessibilityRole="header">
            {t('howToPlay.balloonTitle')}
          </ThemedText>
          <ThemedText type="callout" themeColor="textSecondary">
            {t('howToPlay.balloonBody')}
          </ThemedText>
        </View>
      </Rise>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  step: {
    marginTop: Space.xl,
    gap: Space.lg,
  },
  caption: {
    gap: 14,
  },
  body: {
    lineHeight: 23,
  },
  roles: {
    gap: Space.lg,
    marginTop: Space.xl,
    paddingTop: Space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  role: {
    gap: Space.xxs,
  },
});
