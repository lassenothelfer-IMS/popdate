import { StyleSheet, View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';

import { CssEase, Ease, Motion } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

type ProgressSegmentsProps = {
  total: number;
  /** Segments filled in the text color: the steps done plus the one in progress, like round 2 of 4. */
  filled: number;
  accessibilityLabel: string;
  /** Onboarding's ten steps sit 4 pt apart; rounds sit 6 pt apart. */
  gap?: 4 | 6;
};

/** Each segment grows in from a fifth of its width, 40 ms after the one before. */
function grow(index: number) {
  return new Keyframe({
    0: { opacity: 0.4, transform: [{ scaleX: 0.2 }] },
    100: { opacity: 1, transform: [{ scaleX: 1 }], easing: Ease.rise },
  })
    .duration(600)
    .delay(200 + index * 40);
}

/** A row of 3 pt segments for steps or rounds: the text color up to where you are, inactive after. */
export function ProgressSegments({ total, filled, accessibilityLabel, gap = 6 }: ProgressSegmentsProps) {
  const theme = useTheme();
  const reduced = useReduceMotion();
  return (
    <View
      style={[styles.row, { gap }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}>
      {Array.from({ length: total }, (_, i) => (
        <Animated.View
          key={i}
          entering={reduced ? undefined : grow(i)}
          style={[
            styles.segment,
            {
              backgroundColor: i < filled ? theme.accent : theme.track,
              transitionProperty: 'backgroundColor',
              transitionDuration: Motion.state,
              transitionTimingFunction: CssEase.out,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    transformOrigin: 'left',
  },
});
