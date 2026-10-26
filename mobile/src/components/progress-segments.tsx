import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { CssEase, Motion, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ProgressSegmentsProps = {
  total: number;
  /** Segments filled in ink: the steps done plus the one in progress, like round 2 of 4. */
  filled: number;
  accessibilityLabel: string;
};

/** A row of 3pt bars for steps or rounds: ink up to where you are, a quiet fill after. Never red. */
export function ProgressSegments({ total, filled, accessibilityLabel }: ProgressSegmentsProps) {
  const theme = useTheme();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}>
      {Array.from({ length: total }, (_, i) => (
        <Animated.View
          key={i}
          style={[
            styles.segment,
            {
              backgroundColor: i < filled ? theme.text : theme.surfacePressed,
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
    gap: Space.xxs,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
});
