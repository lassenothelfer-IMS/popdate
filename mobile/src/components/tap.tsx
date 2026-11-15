import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type PressableStateCallbackType,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Spring } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { haptics } from '@/utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type TapProps = Omit<PressableProps, 'children'> & {
  children?: ReactNode | ((state: PressableStateCallbackType) => ReactNode);
  /**
   * How far it shrinks while your finger is on it. 0.97 for buttons and small
   * controls; 1 for wide rows and chat bubbles, where a scale reads as a jump.
   */
  scale?: number;
  /** `none` for things that aren't a tap on something, like the dim behind a sheet. */
  haptic?: 'light' | 'none';
  ref?: ComponentProps<typeof Pressable>['ref'];
};

/**
 * The app's press, for anything that isn't a Button, a row (PressableHighlight)
 * or a chip (PressableScale): a drop-in for React Native's Pressable that gives
 * on a spring while pressed and taps the phone lightly when the press lands.
 * It takes the same props, the `({ pressed }) => …` forms included, so a
 * screen's own dimming keeps working. Still under Reduce Motion.
 */
export function Tap({
  children,
  style,
  scale = 0.97,
  haptic = 'light',
  ref,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}: TapProps) {
  const reduced = useReduceMotion();
  const [pressed, setPressed] = useState(false);
  const down = useSharedValue(0);
  const give = useAnimatedStyle(() => ({
    transform: [{ scale: reduced ? 1 : 1 - (1 - scale) * down.get() }],
  }));
  const state: PressableStateCallbackType = { pressed: pressed && !disabled, hovered: false };

  return (
    <AnimatedPressable
      ref={ref}
      pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
      {...rest}
      disabled={disabled}
      onPressIn={(event: GestureResponderEvent) => {
        setPressed(true);
        down.set(withSpring(1, Spring.press));
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        setPressed(false);
        down.set(withSpring(0, Spring.press));
        onPressOut?.(event);
      }}
      onPress={(event: GestureResponderEvent) => {
        onPress?.(event);
        // After the handler: if it already gave a haptic of its own, this one stays quiet.
        if (haptic === 'light') haptics.tap();
      }}
      style={[typeof style === 'function' ? style(state) : style, scale === 1 ? null : give]}>
      {typeof children === 'function' ? children(state) : children}
    </AnimatedPressable>
  );
}
