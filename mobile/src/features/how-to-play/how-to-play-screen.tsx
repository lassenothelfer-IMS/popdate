import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { MinTouch, Radius, Space } from '@/constants/theme';
import {
  LastBalloonArt,
  OneAndFiveArt,
  RoundArt,
  SameQuestionArt,
} from '@/features/how-to-play/step-art';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

const STEPS: { text: string; art: ReactNode }[] = [
  { text: 'howToPlay.step1', art: <OneAndFiveArt /> },
  { text: 'howToPlay.step2', art: <SameQuestionArt /> },
  { text: 'howToPlay.step3', art: <RoundArt /> },
  { text: 'howToPlay.step4', art: <LastBalloonArt /> },
];

/** A sheet opened from Home, or a page reached some other way: either way, back to where you were. */
function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/home');
}

/** The rules in four pictures, then one line for each role. A modal you close or confirm. */
export function HowToPlayScreen() {
  const theme = useTheme();
  const t = useT();
  return (
    <Screen scroll footer={<Button title={t('howToPlay.gotIt')} onPress={close} />}>
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={close}
          hitSlop={{ left: Space.sm, right: Space.sm }}
          pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <ThemedText type="label">{t('common.close')}</ThemedText>
        </Pressable>
      </View>

      <ThemedText type="display" accessibilityRole="header" style={styles.title}>
        {t('howToPlay.title')}
      </ThemedText>

      <View style={styles.steps}>
        {STEPS.map(({ text, art }, i) => (
          <View
            key={text}
            accessible
            accessibilityLabel={t('howToPlay.stepLabel', {
              number: i + 1,
              total: STEPS.length,
              text: t(text),
            })}
            style={styles.step}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.art, { backgroundColor: theme.field, borderColor: theme.outline }]}>
              {art}
            </View>
            <View style={styles.caption}>
              <ThemedText type="quote" themeColor="textTertiary" style={styles.number}>
                {i + 1}
              </ThemedText>
              <ThemedText style={styles.flex}>{t(text)}</ThemedText>
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.roles, { borderTopColor: theme.border }]}>
        <View style={styles.role}>
          <ThemedText type="headline" accessibilityRole="header">
            {t('howToPlay.choosingTitle')}
          </ThemedText>
          <ThemedText themeColor="textSecondary">{t('howToPlay.choosingBody')}</ThemedText>
        </View>
        <View style={styles.role}>
          <ThemedText type="headline" accessibilityRole="header">
            {t('howToPlay.balloonTitle')}
          </ThemedText>
          <ThemedText themeColor="textSecondary">{t('howToPlay.balloonBody')}</ThemedText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  // A text action in the corner, the mirror of Back.
  close: {
    minHeight: MinTouch,
    justifyContent: 'center',
    paddingLeft: 6,
  },
  pressed: {
    opacity: 0.6,
  },
  title: {
    marginTop: Space.xs,
  },
  steps: {
    gap: Space.lg,
    marginTop: Space.lg,
  },
  step: {
    gap: Space.sm,
  },
  // Every picture gets the same quiet card, tall enough for the busiest one.
  art: {
    minHeight: 136,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Space.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
  },
  caption: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Space.sm,
  },
  // The numeral's column, so every sentence starts at the same edge.
  number: {
    minWidth: 14,
  },
  flex: {
    flex: 1,
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
