import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { CssEase, Motion } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

type PageDotsProps = {
  count: number;
  index: number;
  /** The current page's mark. */
  color: string;
  /** The other pages' marks. */
  restColor: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Which page of a swipeable row you are on, the one way the app shows it: short
 * bars, the current one stretched long, and the stretch slides along as you swipe.
 * Decoration only: the pager itself says the position to screen readers.
 */
export function PageDots({ count, index, color, restColor, style }: PageDotsProps) {
  const reduced = useReduceMotion();
  if (count < 2) return null;
  return (
    <View
      style={[styles.row, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, i) => {
        const on = i === index;
        return (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                width: on ? 22 : 8,
                backgroundColor: on ? color : restColor,
                transitionProperty: ['width', 'backgroundColor'],
                transitionDuration: reduced ? 0 : Motion.state,
                transitionTimingFunction: CssEase.out,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    height: 3,
    borderRadius: 2,
  },
});
