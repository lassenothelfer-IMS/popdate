import { Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { CssEase, Motion } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/utils/haptics';

type ToggleProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel: string;
  /** 44 x 26 inside cards, 50 x 30 elsewhere. */
  compact?: boolean;
};

/**
 * On: the track in the text color with a dark knob. Off: the inactive track
 * with a light knob. A selection haptic on every change.
 */
export function Toggle({ value, onValueChange, disabled, accessibilityLabel, compact }: ToggleProps) {
  const theme = useTheme();
  const width = compact ? 44 : 50;
  const height = compact ? 26 : 30;
  const knob = height - 4;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      aria-checked={value}
      disabled={disabled}
      hitSlop={{ top: 9, bottom: 9, left: 4, right: 4 }}
      onPress={() => {
        haptics.selection();
        onValueChange(!value);
      }}>
      <Animated.View
        style={[
          styles.track,
          {
            width,
            height,
            borderRadius: height / 2,
            backgroundColor: value ? theme.accent : theme.track,
            opacity: disabled ? 0.5 : 1,
            transitionProperty: 'backgroundColor',
            transitionDuration: Motion.state,
            transitionTimingFunction: CssEase.out,
          },
        ]}>
        <Animated.View
          style={[
            styles.knob,
            {
              width: knob,
              height: knob,
              borderRadius: knob / 2,
              backgroundColor: value ? theme.onAccent : theme.inverse,
              transform: [{ translateX: value ? width - knob - 2 : 2 }],
              transitionProperty: ['transform', 'backgroundColor'],
              transitionDuration: Motion.state,
              transitionTimingFunction: CssEase.out,
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    justifyContent: 'center',
  },
  knob: {
    position: 'absolute',
    top: 2,
    left: 0,
  },
});
