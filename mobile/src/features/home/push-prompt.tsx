import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Ease, Fonts, MinTouch, Motion, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { haptics } from '@/utils/haptics';
import { enablePush, getPushPermission } from '@/utils/push';

/** "Not now" holds until the app restarts, even when Home mounts again after a room. */
let dismissedThisSession = false;

const cardIn = FadeIn.duration(Motion.state).easing(Ease.out).reduceMotion(ReduceMotion.Never);

/** The pill is drawn at 40pt and touched at 44pt. */
const PILL = 40;

/**
 * A calm card under Play, only while push permission hasn't been asked yet:
 * "Turn on" asks (iOS shows its prompt once), "Not now" hides it for this session.
 */
export function PushPrompt({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const t = useT();
  const [visible, setVisible] = useState(false);
  const [asking, setAsking] = useState(false);

  // Checked on every visit, so turning notifications on in Settings hides the card too.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web' || dismissedThisSession) return;
      let active = true;
      getPushPermission()
        .then((permission) => {
          if (active) setVisible(permission === 'undetermined');
        })
        // Can't tell: stay quiet rather than ask at the wrong time.
        .catch(() => {});
      return () => {
        active = false;
      };
    }, []),
  );

  if (!visible) return null;

  async function turnOn() {
    haptics.selection();
    setAsking(true);
    try {
      await enablePush();
    } catch {
      // Whatever the system answered, the question has been asked: the card's job is done.
    }
    dismissedThisSession = true;
    setVisible(false);
  }

  function notNow() {
    haptics.selection();
    dismissedThisSession = true;
    setVisible(false);
  }

  return (
    <Animated.View
      entering={cardIn}
      style={[styles.card, { backgroundColor: theme.field, borderColor: theme.outline }, style]}>
      <ThemedText type="callout">{t('home.pushPrompt')}</ThemedText>
      <View style={styles.actions}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('common.turnOn')}
          accessibilityHint={t('home.pushTurnOnHint')}
          accessibilityState={{ disabled: asking, busy: asking }}
          disabled={asking}
          hitSlop={{ top: (MinTouch - PILL) / 2, bottom: (MinTouch - PILL) / 2 }}
          onPress={turnOn}
          style={[
            styles.pill,
            { backgroundColor: theme.inverse, boxShadow: `inset 0 1px 0 ${theme.highlight}` },
          ]}>
          {asking ? (
            <ActivityIndicator color={theme.onInverse} />
          ) : (
            <Text style={[styles.pillLabel, { color: theme.onInverse }]}>{t('common.turnOn')}</Text>
          )}
        </PressableScale>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.notNow')}
          disabled={asking}
          onPress={notNow}
          pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
          style={({ pressed }) => [styles.text, pressed && styles.pressed]}>
          <ThemedText type="label" themeColor="textSecondary">
            {t('common.notNow')}
          </ThemedText>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Space.sm,
    padding: Space.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Space.xs,
  },
  pill: {
    minHeight: PILL,
    minWidth: 96,
    paddingHorizontal: 18,
    borderRadius: Radius.pill,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillLabel: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 600,
    textAlign: 'center',
  },
  text: {
    minHeight: MinTouch,
    justifyContent: 'center',
    paddingHorizontal: Space.xs,
  },
  pressed: {
    opacity: 0.6,
  },
});
