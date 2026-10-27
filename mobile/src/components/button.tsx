import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { ButtonShadow, Fonts, MinTouch, Radius, Space } from '@/constants/theme';
import { useScheme, useTheme } from '@/hooks/use-theme';

type ButtonProps = {
  title: string;
  onPress?: () => void;
  /**
   * `primary`: the one main action of a screen, a full-width rose button.
   * `coral`: Pop, Match, Recording, and Pop and report. Rose like the primary now.
   * `secondary`: a quieter peach alternative.
   * `ghost`: a 44 pt text button under the primary, like "Skip" or "Stay and watch".
   */
  variant?: 'primary' | 'coral' | 'secondary' | 'ghost';
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
  const scheme = useScheme();
  const inactive = disabled && !loading;
  const fills = {
    primary: { background: theme.accent, label: theme.onAccent },
    coral: { background: theme.accent, label: theme.onAccent },
    secondary: { background: theme.secondary, label: theme.onSecondary },
    ghost: { background: 'transparent', label: theme.textSecondary },
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
      <Text
        style={[styles.label, variant === 'ghost' && styles.textLabel, { color: fill.label }]}>
        {title}
      </Text>
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

  // The named finish: a soft rose glow under the primary and coral fills.
  const finish = inactive
    ? null
    : variant === 'primary' || variant === 'coral'
      ? { boxShadow: ButtonShadow[scheme] }
      : { borderWidth: 1, borderColor: theme.borderStrong };

  return (
    <PressableScale
      {...a11y}
      disabled={disabled || loading}
      onPress={onPress}
      style={[styles.base, { backgroundColor: fill.background }, finish]}>
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: Radius.xl,
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
    textAlign: 'center',
  },
  /** Text buttons: 15/500 in the secondary tone. */
  textLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 500,
  },
});
