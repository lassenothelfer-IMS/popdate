import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { Fonts, MinTouch, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = {
  title: string;
  onPress?: () => void;
  /**
   * `primary`: the main action of a screen, and Play and Pop too: an ink pill.
   * `secondary`: a quieter filled alternative.
   * `ghost`: a text action, like "Skip with a test profile" or "Stay and watch".
   */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Drawn before the title, like the target's balloon in "Pop Sara's balloon". */
  icon?: ReactNode;
  /** Inactive buttons get a solid quiet fill, never faded. Don't put instructions in one. */
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  accessibilityHint,
}: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled && !loading;
  const fills = {
    primary: { background: theme.inverse, label: theme.onInverse },
    secondary: { background: theme.surface, label: theme.text },
    ghost: { background: 'transparent', label: theme.text },
  } as const;
  const fill = inactive
    ? {
        background: variant === 'ghost' ? 'transparent' : theme.surface,
        label: theme.textTertiary,
      }
    : fills[variant];
  const a11y = {
    accessibilityRole: 'button',
    accessibilityLabel: title,
    accessibilityHint,
    accessibilityState: { disabled: disabled || loading, busy: loading },
  } as const;
  const content = loading ? (
    <ActivityIndicator color={fill.label} />
  ) : (
    <View style={styles.content}>
      {icon}
      <Text style={[styles.label, { color: fill.label }]}>{title}</Text>
    </View>
  );

  // A text action dims while pressed instead of scaling.
  if (variant === 'ghost') {
    return (
      <Pressable
        {...a11y}
        disabled={disabled || loading}
        onPress={onPress}
        pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
        style={({ pressed }) => [styles.base, styles.ghost, pressed && styles.dimmed]}>
        {content}
      </Pressable>
    );
  }

  return (
    <PressableScale
      {...a11y}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.base,
        { backgroundColor: fill.background },
        // Lacquer: a hairline of light along the top of an ink button.
        variant === 'primary' && !inactive && { boxShadow: `inset 0 1px 0 ${theme.highlight}` },
      ]}>
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: Radius.pill,
    borderCurve: 'continuous',
    paddingHorizontal: Space.lg,
    paddingVertical: Space.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: {
    minHeight: MinTouch,
  },
  dimmed: {
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    fontFamily: Fonts.sans,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 600,
    letterSpacing: -0.17,
    textAlign: 'center',
  },
});
