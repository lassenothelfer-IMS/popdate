import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Ease, Motion, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { haptics } from '@/utils/haptics';
import { enablePush, getPushPermission } from '@/utils/push';

/** "Not now" holds until the app restarts, even when Home mounts again after a room. */
let dismissedThisSession = false;

const cardIn = FadeIn.duration(Motion.state).easing(Ease.out).reduceMotion(ReduceMotion.Never);


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
        <Button
          title={t('common.turnOn')}
          size="small"
          fullWidth={false}
          loading={asking}
          accessibilityHint={t('home.pushTurnOnHint')}
          onPress={() => void turnOn()}
        />
        <Button
          title={t('common.notNow')}
          variant="plain"
          fullWidth={false}
          disabled={asking}
          onPress={notNow}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Space.sm,
    padding: Space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Space.xs,
  },
});
