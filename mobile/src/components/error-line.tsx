import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Ease, Motion, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * How every error appears: it fades in with its icon and message. No shake.
 * Opacity only, so it stays under Reduce Motion.
 */
export const errorEnter = FadeIn.duration(Motion.state)
  .easing(Ease.out)
  .reduceMotion(ReduceMotion.Never);

/** The error icon, lined up with the first line of footnote text next to it. */
export function ErrorIcon() {
  const theme = useTheme();
  return (
    <View style={styles.icon}>
      <Icon name="error" size={14} color={theme.danger} />
    </View>
  );
}

/**
 * A failed call, right above the action it belongs to: crimson, always with the
 * icon. Pair it with haptics.error() where the call fails.
 */
export function ErrorLine({ message }: { message: string }) {
  return (
    <Animated.View
      key={message}
      entering={errorEnter}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel={message}
      style={styles.line}>
      <ErrorIcon />
      <ThemedText type="footnote" themeColor="danger" style={styles.text}>
        {message}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: Space.xxs,
  },
  // Centers the 14pt icon on the footnote's 18pt first line.
  icon: {
    paddingTop: 2,
  },
  text: {
    flexShrink: 1,
  },
});
