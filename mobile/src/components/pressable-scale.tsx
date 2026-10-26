import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { CssEase, Motion } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  /** Style of the visible element, which scales. */
  style?: StyleProp<ViewStyle>;
  /** Style of the touch area around it, for flex or margins in a row. */
  containerStyle?: StyleProp<ViewStyle>;
};

/**
 * Press feedback for buttons, chips and small controls: shrinks to 0.97 on
 * press-in, so it answers before the tap completes. With Reduce Motion it dims
 * to 0.8 instead, the way iOS does. Rows and cards use PressableHighlight
 * instead, because a full-width row that scales reads as a jump.
 */
export function PressableScale({
  children,
  style,
  containerStyle,
  disabled,
  ...rest
}: PressableScaleProps) {
  const reduced = useReduceMotion();
  return (
    <Pressable
      disabled={disabled}
      pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
      style={containerStyle}
      {...rest}>
      {({ pressed }) => {
        const active = pressed && !disabled;
        return (
          <Animated.View
            style={[
              style,
              reduced
                ? { opacity: active ? 0.8 : 1 }
                : {
                    transform: [{ scale: active ? 0.97 : 1 }],
                    transitionProperty: 'transform',
                    transitionDuration: Motion.press,
                    transitionTimingFunction: CssEase.out,
                  },
            ]}>
            {children}
          </Animated.View>
        );
      }}
    </Pressable>
  );
}
