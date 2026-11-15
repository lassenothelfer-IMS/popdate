import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { CssEase, Motion } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/utils/haptics';

type PressableHighlightProps = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Fill at rest. Defaults to the surface color. */
  background?: string;
};

/** Press feedback for rows and cards: the row dims a little while pressed and taps the phone lightly. No fill flashes in behind it. */
export function PressableHighlight({
  children,
  style,
  background,
  disabled,
  onPress,
  ...rest
}: PressableHighlightProps) {
  const theme = useTheme();
  const resting = background ?? theme.surface;
  return (
    <Pressable
      disabled={disabled}
      pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
      {...rest}
      onPress={(event) => {
        onPress?.(event);
        // Quiet if the row's own handler already gave a haptic.
        haptics.tap();
      }}>
      {({ pressed }) => (
        <Animated.View
          style={[
            style,
            {
              backgroundColor: resting,
              opacity: pressed && !disabled ? 0.55 : 1,
              transitionProperty: 'opacity',
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
