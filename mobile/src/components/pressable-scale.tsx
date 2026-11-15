import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Spring } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { haptics } from '@/utils/haptics';

type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  /** Style of the visible element, which scales. */
  style?: StyleProp<ViewStyle>;
  /** Style of the touch area around it, for flex or margins in a row. */
  containerStyle?: StyleProp<ViewStyle>;
};

/**
 * Press feedback for chips and small controls: shrinks to 0.97 on a spring at
 * press-in, so it answers before the tap completes, bounces back on release,
 * and taps the phone lightly when the press lands. With Reduce Motion it dims
 * to 0.8 instead, the way iOS does. Rows and cards use PressableHighlight
 * instead, because a full-width row that scales reads as a jump.
 */
export function PressableScale({
  children,
  style,
  containerStyle,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const reduced = useReduceMotion();
  const down = useSharedValue(0);
  const give = useAnimatedStyle(() =>
    reduced
      ? { opacity: 1 - 0.2 * down.get() }
      : { transform: [{ scale: 1 - 0.03 * down.get() }] },
  );
  return (
    <Pressable
      disabled={disabled}
      pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
      style={containerStyle}
      {...rest}
      onPressIn={(event) => {
        down.set(withSpring(1, Spring.press));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        down.set(withSpring(0, Spring.press));
        onPressOut?.(event);
      }}
      onPress={(event) => {
        onPress?.(event);
        // Quiet if the control's own handler already gave a haptic.
        haptics.tap();
      }}>
      <Animated.View style={[style, give]}>{children}</Animated.View>
    </Pressable>
  );
}
