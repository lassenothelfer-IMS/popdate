import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { CssEase, Motion } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type PressableHighlightProps = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Fill at rest. Defaults to the surface color. */
  background?: string;
};

/** Press feedback for rows and cards: the fill darkens while pressed. */
export function PressableHighlight({
  children,
  style,
  background,
  disabled,
  ...rest
}: PressableHighlightProps) {
  const theme = useTheme();
  const resting = background ?? theme.surface;
  return (
    <Pressable
      disabled={disabled}
      pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
      {...rest}>
      {({ pressed }) => (
        <Animated.View
          style={[
            style,
            {
              backgroundColor: pressed && !disabled ? theme.surfacePressed : resting,
              transitionProperty: 'backgroundColor',
              transitionDuration: Motion.press,
              transitionTimingFunction: CssEase.out,
            },
          ]}>
          {children}
        </Animated.View>
      )}
    </Pressable>
  );
}
