import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Photo } from '@/components/photo';
import { Ease, Fonts } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { webSafeKeyframe } from '@/utils/web-motion';

// The pieces the designed full-screen moments share (design/four-screens): the
// queue, the two "room is ready" screens and "Not this time". Each is drawn on a
// 390 x 844 canvas with fixed positions, scaled as one to fit the phone.

export const STAGE_WIDTH = 390;
export const STAGE_HEIGHT = 844;

/** Text on a stage never grows with the system text size: the canvas is fixed. */
export const stageText = { allowFontScaling: false } as const;

type StageProps = {
  children: ReactNode;
};

/** The 390 x 844 canvas, scaled as one piece to fit the window and centered in it. */
export function Stage({ children }: StageProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const scale = Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT);
  return (
    <View style={[styles.window, { backgroundColor: theme.page }]}>
      <View style={[styles.canvas, { transform: [{ scale }] }]}>{children}</View>
    </View>
  );
}

/** Built once per position: block n starts n x 80 ms after the screen. */
const rises = new Map<number, InstanceType<typeof Keyframe>>();
function rise(index: number) {
  let keyframe = rises.get(index);
  if (!keyframe) {
    keyframe = new Keyframe({
      0: { opacity: 0, transform: [{ translateY: 14 }] },
      100: { opacity: 1, transform: [{ translateY: 0 }], easing: Ease.rise },
    })
      .duration(760)
      .delay(index * 80);
    rises.set(index, keyframe);
  }
  return keyframe;
}

type StageBlockProps = {
  /** The block's place on the screen, top to bottom, from 0. */
  index: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: 'none' | 'box-none' | 'auto';
};

/** A top-level block: it rises 14 pt and fades in over 760 ms, 80 ms after the one above. */
export function StageBlock({ index, children, style, pointerEvents }: StageBlockProps) {
  const reduced = useReduceMotion();
  return (
    <Animated.View
      entering={reduced ? undefined : webSafeKeyframe(rise(index))}
      pointerEvents={pointerEvents}
      style={[styles.block, style]}>
      {children}
    </Animated.View>
  );
}

/** The three bobs: period and where in it each starts, so balloons never move in sync. */
const BOBS = {
  a: { period: 5000, offset: 0 },
  b: { period: 4200, offset: 1600 / 4200 },
  c: { period: 5600, offset: 3000 / 5600 },
} as const;

type BobProps = {
  kind?: keyof typeof BOBS;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** A balloon floating: up 7 pt and tipped 1.6 degrees, around its foot, and back. Still under Reduce Motion. */
export function Bob({ kind = 'a', children, style }: BobProps) {
  const reduced = useReduceMotion();
  const { period, offset } = BOBS[kind];
  const turn = useSharedValue(offset);
  useEffect(() => {
    if (reduced) {
      cancelAnimation(turn);
      return;
    }
    turn.set(offset);
    turn.set(withRepeat(withTiming(offset + 1, { duration: period, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(turn);
  }, [reduced, turn, period, offset]);
  const float = useAnimatedStyle(() => {
    if (reduced) return { transform: [{ translateY: 0 }, { rotate: '0deg' }] };
    // 0 at rest, 1 at the top: ease-in-out both ways.
    const up = (1 - Math.cos(turn.get() * 2 * Math.PI)) / 2;
    return { transform: [{ translateY: -7 * up }, { rotate: `${-1.6 * up}deg` }] };
  });
  return <Animated.View style={[styles.foot, style, float]}>{children}</Animated.View>;
}

type PulseProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** An empty seat, or a live dot: its opacity breathes from .45 to .9 over 2.6 s. */
export function Pulse({ children, style }: PulseProps) {
  const reduced = useReduceMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      cancelAnimation(turn);
      return;
    }
    turn.set(0);
    turn.set(withRepeat(withTiming(1, { duration: 2600, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(turn);
  }, [reduced, turn]);
  const breathe = useAnimatedStyle(() => ({
    opacity: reduced ? 0.9 : 0.45 + 0.45 * ((1 - Math.cos(turn.get() * 2 * Math.PI)) / 2),
  }));
  return <Animated.View style={[style, breathe]}>{children}</Animated.View>;
}

type YouChipProps = {
  label: string;
  /** 12 pt on the queue, 11 pt in a seat card. */
  size?: 'large' | 'small';
  style?: StyleProp<ViewStyle>;
};

/** The black "You" pill. */
export function YouChip({ label, size = 'small', style }: YouChipProps) {
  const theme = useTheme();
  const large = size === 'large';
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: theme.text, paddingVertical: large ? 3 : 2, paddingHorizontal: large ? 10 : 8 },
        style,
      ]}>
      <Text {...stageText} style={[styles.chipText, { color: theme.page, fontSize: large ? 12 : 11, lineHeight: large ? 15 : 14 }]}>
        {label}
      </Text>
    </View>
  );
}

type RingedAvatarProps = {
  initial: string;
  /** Their photo, once there is one to show. A missing or mock photo shows the initial. */
  uri?: string;
  /** The user's own seat is dark with a light initial. */
  dark?: boolean;
};

/** A 48 pt photo or initial in a double ring: 2 pt of canvas, then 1.5 pt of plum. */
export function RingedAvatar({ initial, uri, dark = false }: RingedAvatarProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.avatar,
        {
          backgroundColor: dark ? theme.text : AVATAR_TINT,
          boxShadow: `0 0 0 2px ${theme.page}, 0 0 0 3.5px ${theme.brand}`,
        },
      ]}>
      {uri && !uri.startsWith('mock://') ? (
        <Photo uri={uri} hairline={false} style={[StyleSheet.absoluteFill, styles.avatarPhoto]} />
      ) : (
        <Text {...stageText} style={[styles.avatarInitial, { color: dark ? theme.page : theme.brand }]}>
          {initial}
        </Text>
      )}
    </View>
  );
}

/** The chooser's avatar fill in the design: the plum, very pale. */
const AVATAR_TINT = '#EAD6E6';

/** Shared text looks, so the four screens set type the same way. */
export const stageType = StyleSheet.create({
  sans: { fontFamily: Fonts.sans },
  serif: { fontFamily: Fonts.serif },
  /** The big numerals: the serif at 500 with the text optical size, not the display cut. */
  numeral: {
    fontFamily: Fonts.serif,
    fontWeight: 500,
    fontVariant: ['lining-nums'],
    fontVariationSettings: "'opsz' 28, 'WONK' 0, 'SOFT' 0",
  } as TextStyle,
});

const styles = StyleSheet.create({
  window: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  canvas: {
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
  },
  block: {
    position: 'absolute',
  },
  foot: {
    transformOrigin: 'bottom',
  },
  chip: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontFamily: Fonts.sans,
    fontWeight: 700,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPhoto: {
    borderRadius: 24,
  },
  avatarInitial: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    lineHeight: 24,
  },
});
