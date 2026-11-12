import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { MinTouch, type Palette } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/utils/haptics';

/**
 * `prominent`: the one main action of a screen, black.
 * `tinted`: the second option, the page color with an outline.
 * `glass`: only for buttons floating over content (photos, the balloon stage, sheets).
 * `plain`: a text button, transparent at rest.
 * `coral`: the Pop action only, in the brand plum. Never anywhere else.
 * `brand`: the paywall's buy button, in the brand plum. Never anywhere else.
 */
export type ButtonVariant = 'prominent' | 'tinted' | 'glass' | 'plain' | 'coral' | 'brand';

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  /** `large` is 52 pt, `small` 44 pt. Plain buttons default to small, the rest to large. */
  size?: 'large' | 'small';
  /** Stretches to its container's width, as the main actions do. */
  fullWidth?: boolean;
  /** Drawn before the title, like the target's balloon in "Pop Sara's balloon". */
  icon?: ReactNode;
  /** Drawn after the title, in the label's color: a chevron, or a struck-through price. Not read by VoiceOver. */
  trailing?: (labelColor: string) => ReactNode;
  /** Only the icon shows, in a circle; the title is still read by VoiceOver. */
  iconOnly?: boolean;
  disabled?: boolean;
  /** Keeps the size and swaps the label for a spinner in the label color. */
  loading?: boolean;
  accessibilityHint?: string;
  /** Placement only, like alignSelf or a margin. */
  style?: StyleProp<ViewStyle>;
};

type Look = {
  fill: string;
  pressed: string;
  label: string;
  /** Inner rims, plus the cast shadow glass and coral keep at rest. */
  finish?: string;
  /** The edge: 0.5 pt on glass, 1 pt on the outlined secondary button. */
  edge?: string;
  edgeWidth?: number;
};

/**
 * Each variant's colors, from the theme so they follow the palette: black for
 * prominent and plain, an outline for tinted, the brand plum for Pop and the
 * paywall, the text color on glass. Rims and shadows are from the iOS 26 button spec.
 */
function looks(theme: Palette): Record<ButtonVariant, Look> {
  const brand: Look = {
    fill: theme.brand,
    pressed: mix(theme.brand, '#FFFFFF', 0.1),
    label: theme.onBrand,
    finish: 'inset 0 1px 0 rgba(255,255,255,0.16)',
  };
  return {
    prominent: {
      fill: theme.accent,
      pressed: mix(theme.accent, '#FFFFFF', 0.14),
      label: theme.onAccent,
      finish: 'inset 0 1px 0 rgba(255,255,255,0.12)',
    },
    tinted: {
      fill: theme.secondary,
      pressed: theme.field,
      label: theme.onSecondary,
      edge: theme.secondaryEdge,
      edgeWidth: 1,
    },
    glass: {
      fill: 'rgba(255,255,255,0.42)',
      pressed: 'rgba(255,255,255,0.56)',
      label: theme.text,
      finish: `inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.05), 0 8px 24px -12px ${withAlpha(theme.text, 0.28)}`,
      edge: 'rgba(255,255,255,0.5)',
    },
    plain: {
      fill: withAlpha(theme.accentText, 0),
      pressed: withAlpha(theme.accentText, 0.08),
      label: theme.accentText,
    },
    coral: {
      ...brand,
      finish: `inset 0 1px 0 rgba(255,255,255,0.3), 0 10px 28px -10px ${withAlpha(theme.brand, 0.55)}`,
    },
    brand,
  };
}

/** Two hex colors mixed, `amount` of the way from `from` to `to`. */
function mix(from: string, to: string, amount: number) {
  const channel = (hex: string, i: number) => parseInt(hex.slice(i, i + 2), 16);
  const out = [1, 3, 5].map((i) =>
    Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * amount)
      .toString(16)
      .padStart(2, '0'),
  );
  return `#${out.join('')}`;
}

/** A press grows the button and settles back like a light bounce. */
const SPRING = { damping: 14, stiffness: 220, mass: 0.6 };
const HEIGHT = { large: 52, small: 44 };

/** A hex or rgba color at another opacity. */
function withAlpha(color: string, alpha: number) {
  if (color.startsWith('#')) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const [r, g, b, a = '1'] = color.replace(/rgba?\(|\)|\s/g, '').split(',');
  return `rgba(${r},${g},${b},${Number(a) * alpha})`;
}

/**
 * Every button in the app: a capsule, 52 or 44 pt tall, with an SF Pro 17
 * semibold label. A press grows it a little, lightens the fill and lifts a soft
 * shadow; under Reduce Motion only the color changes.
 */
export function Button({
  title,
  onPress,
  variant = 'prominent',
  size = variant === 'plain' ? 'small' : 'large',
  fullWidth = true,
  icon,
  trailing,
  iconOnly = false,
  disabled = false,
  loading = false,
  accessibilityHint,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const reduced = useReduceMotion();
  const pressed = useSharedValue(0);
  // Real glass only where the system draws it (iOS 26); elsewhere glass falls back to tinted.
  const nativeGlass = variant === 'glass' && Platform.OS === 'ios' && isLiquidGlassAvailable();
  const shown: ButtonVariant = variant === 'glass' && !nativeGlass ? 'tinted' : variant;
  const look = looks(theme)[shown];
  const inactive = disabled && !loading;
  const solid = shown === 'prominent' || shown === 'brand';
  const fill = inactive && solid ? withAlpha(look.fill, 0.28) : look.fill;
  const label = inactive ? withAlpha(look.label, solid ? 0.85 : 0.4) : look.label;
  const grow = variant === 'glass' ? 0.03 : 0.02;
  const height = HEIGHT[size];

  const capsule = useAnimatedStyle(() => ({
    transform: [{ scale: reduced ? 1 : 1 + grow * pressed.get() }],
    backgroundColor: nativeGlass
      ? 'transparent'
      : interpolateColor(pressed.get(), [0, 1], [fill, look.pressed]),
  }));
  const lift = useAnimatedStyle(() => ({ opacity: pressed.get() }));

  function pressIn() {
    pressed.set(withSpring(1, SPRING));
    if (variant === 'prominent' || variant === 'coral' || variant === 'brand') haptics.light();
  }
  function pressOut() {
    pressed.set(withSpring(0, SPRING));
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
      style={[
        styles.target,
        fullWidth ? styles.full : null,
        iconOnly ? { width: Math.max(height, MinTouch) } : null,
        style,
      ]}>
      {/* The soft shadow a press lifts: the fill's own tint at 45%. */}
      {inactive ? null : (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.capsule,
            { boxShadow: `0 6px 18px -6px ${withAlpha(look.fill.startsWith('rgba') ? look.label : look.fill, 0.45)}` },
            lift,
          ]}
        />
      )}
      <Animated.View
        style={[
          styles.capsule,
          { minHeight: height, paddingHorizontal: iconOnly ? 0 : size === 'large' ? 20 : 16 },
          !inactive && look.finish ? { boxShadow: look.finish } : null,
          look.edge && !nativeGlass ? { borderWidth: look.edgeWidth ?? 0.5, borderColor: look.edge } : null,
          capsule,
        ]}>
        {nativeGlass ? (
          <GlassView
            isInteractive
            glassEffectStyle="regular"
            colorScheme="light"
            // A light tint, so the dark label stays readable when the glass is over a dark photo.
            tintColor="rgba(255, 253, 254, 0.7)"
            style={[StyleSheet.absoluteFill, styles.capsule]}
          />
        ) : null}
        {loading ? (
          <ActivityIndicator size="small" color={label} />
        ) : (
          <View style={styles.content}>
            {icon}
            {iconOnly ? null : (
              <Text numberOfLines={1} style={[styles.label, { color: label }]}>
                {title}
              </Text>
            )}
            {iconOnly ? null : trailing?.(label)}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: {
    minHeight: MinTouch,
    justifyContent: 'center',
  },
  full: {
    alignSelf: 'stretch',
  },
  capsule: {
    borderRadius: 999,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 600,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
});
