import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { Fonts, MinTouch, Radius, Space } from '@/constants/theme';
import { useScheme, useTheme } from '@/hooks/use-theme';

type ButtonProps = {
  title: string;
  onPress?: () => void;
  /**
   * `primary`: the one main action of a screen, a full-width cream (ink in Cream) button.
   * `coral`: only for Pop, Match, Recording, and Pop and report. At most one per screen.
   * `secondary`: a quieter filled alternative.
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
  const velvet = useScheme() === 'dark';
  const inactive = disabled && !loading;
  const fills = {
    primary: { background: theme.inverse, label: theme.onInverse },
    coral: { background: theme.accent, label: theme.onAccent },
    secondary: { background: theme.surface, label: theme.text },
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

  // The named finishes: a light top edge and a soft glow under the primary and coral fills.
  const finish = inactive
    ? null
    : variant === 'primary'
      ? {
          boxShadow: velvet
            ? 'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(0,0,0,0.4), 0 14px 30px -12px rgba(246,234,230,0.35)'
            : `inset 0 1px 0 ${theme.highlight}`,
        }
      : variant === 'coral'
        ? { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 14px 32px -10px rgba(240,105,92,0.6)' }
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
