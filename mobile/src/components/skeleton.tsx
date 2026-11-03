import { useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Radius } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

/**
 * A placeholder block while something loads: it shimmers between surface 1 and
 * surface 2 over 1.6 s. Never a spinner. Holds still under Reduce Motion.
 */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const reduced = useReduceMotion();
  const shimmer = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      cancelAnimation(shimmer);
      shimmer.set(0);
      return;
    }
    shimmer.set(withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true));
  }, [reduced, shimmer]);
  const from = theme.field;
  const to = theme.surface;
  const animated = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(shimmer.get(), [0, 1], [from, to]),
  }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.block, animated, style]}
    />
  );
}

const styles = StyleSheet.create({
  block: {
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
  },
});
