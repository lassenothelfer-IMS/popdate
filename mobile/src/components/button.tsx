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
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { MinTouch } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useScheme } from '@/hooks/use-theme';
import { haptics } from '@/utils/haptics';

/**
 * `prominent`: the one main action of a screen.
 * `tinted`: a quieter filled alternative.
 * `glass`: only for buttons floating over content (photos, the balloon stage, sheets).
 * `plain`: a text button, transparent at rest.
 * `coral`: the Pop action only. Never anywhere else.
 */
export type ButtonVariant = 'prominent' | 'tinted' | 'glass' | 'plain' | 'coral';

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
  /** The 0.5 pt edge of glass. */
  edge?: string;
};

/** Values from the iOS 26 button spec, per theme (cream is light, velvet is dark). */
const LOOKS: Record<ButtonVariant, { light: Look; dark: Look }> = {
  prominent: {
    light: {
      fill: '#7A2E3A',
      pressed: '#8B3542',
      label: '#FFF9F6',
      finish: 'inset 0 1px 0 rgba(255,255,255,0.16)',
    },
    dark: {
      fill: '#F6EAE6',
      pressed: '#FFFFFF',
      label: '#1D070E',
      finish: 'inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.06)',
    },
  },
  tinted: {
    light: { fill: 'rgba(122,46,58,0.12)', pressed: 'rgba(122,46,58,0.2)', label: '#7A2E3A' },
    dark: { fill: 'rgba(246,234,230,0.12)', pressed: 'rgba(246,234,230,0.2)', label: '#F6EAE6' },
  },
  glass: {
    light: {
      fill: 'rgba(255,255,255,0.42)',
      pressed: 'rgba(255,255,255,0.56)',
      label: '#1C1917',
      finish:
        'inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.05), 0 8px 24px -12px rgba(28,25,23,0.28)',
      edge: 'rgba(255,255,255,0.5)',
    },
    dark: {
      fill: 'rgba(255,255,255,0.08)',
      pressed: 'rgba(255,255,255,0.16)',
      label: '#F6EAE6',
      finish: 'inset 0 1px 0 rgba(255,255,255,0.28), 0 10px 30px -12px rgba(0,0,0,0.6)',
      edge: 'rgba(255,255,255,0.14)',
    },
  },
  plain: {
    light: { fill: 'rgba(122,46,58,0)', pressed: 'rgba(122,46,58,0.08)', label: '#7A2E3A' },
    dark: { fill: 'rgba(255,154,140,0)', pressed: 'rgba(255,154,140,0.08)', label: '#FF9A8C' },
  },
  coral: {
    light: {
      fill: '#F0695C',
      pressed: '#F27C70',
      label: '#FFFFFF',
      finish: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 10px 28px -10px rgba(240,105,92,0.55)',
    },
    dark: {
      fill: '#F0695C',
      pressed: '#F27C70',
      label: '#FFFFFF',
      finish: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 10px 28px -10px rgba(240,105,92,0.55)',
    },
  },
};

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
  iconOnly = false,
  disabled = false,
  loading = false,
  accessibilityHint,
  style,
}: ButtonProps) {
  const scheme = useScheme();
  const reduced = useReduceMotion();
  const pressed = useSharedValue(0);
  // Real glass only where the system draws it (iOS 26); elsewhere glass falls back to tinted.
  const nativeGlass = variant === 'glass' && Platform.OS === 'ios' && isLiquidGlassAvailable();
  const shown: ButtonVariant = variant === 'glass' && !nativeGlass ? 'tinted' : variant;
  const look = LOOKS[shown][scheme];
  const inactive = disabled && !loading;
  const fill = inactive && shown === 'prominent' ? withAlpha(look.fill, 0.28) : look.fill;
  const label = inactive
    ? withAlpha(look.label, shown === 'prominent' ? 0.85 : 0.4)
    : look.label;
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
    if (variant === 'prominent' || variant === 'coral') haptics.light();
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
          look.edge && !nativeGlass ? { borderWidth: 0.5, borderColor: look.edge } : null,
          capsule,
        ]}>
        {nativeGlass ? (
          <GlassView
            isInteractive
            glassEffectStyle="regular"
            colorScheme={scheme}
            style={[StyleSheet.absoluteFill, styles.capsule]}
          />
        ) : null}
        {/* Velvet glass: a top sheen, white 14% fading out by 45%. */}
        {nativeGlass && scheme === 'dark' ? <Sheen /> : null}
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
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

function Sheen() {
  return (
    <Svg style={[StyleSheet.absoluteFill, styles.capsule]} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <LinearGradient id="buttonSheen" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.14} />
          <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" rx={999} fill="url(#buttonSheen)" />
    </Svg>
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
