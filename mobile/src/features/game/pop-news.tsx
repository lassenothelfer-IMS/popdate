import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Balloon, PoppedMark } from '@/components/balloon';
import { ThemedText } from '@/components/themed-text';
import { Ease, lacquerFor, Motion, Space } from '@/constants/theme';
import { announce as say, sentence } from '@/features/game/announce';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/utils/haptics';
import { nativeOnly } from '@/utils/web-motion';

/** The pop's stage: the balloon floats in the middle, the burst plays around it. */
const STAGE_HEIGHT = 300;
const BALLOON_WIDTH = 110;
const STRING_LENGTH = 120;
/** The popped mark that stays once the moment has passed (a pop you came back to). */
const MARK_SIZE = 72;

/**
 * The pop timeline in ms (DESIGN.md section 7). A pop you watch starts still,
 * swells from 600 ms and bursts at 2300 ms; the chooser's own pop has already
 * been held to full, so it starts at the burst.
 */
const SWELL_AT = 600;
const SWELL_MS = 1600;
const BURST_AT = 2300;
const TEXT_AT = 2900;
const TEXT_MS = 800;
const TIMELINE_MS = TEXT_AT + TEXT_MS;

/** How long the room holds on a pop before the next phase: the whole sequence and a breath. */
export function popHoldMs(own: boolean, reduced: boolean) {
  if (reduced) return Motion.hold;
  return (own ? TIMELINE_MS - BURST_AT : TIMELINE_MS) + 900;
}

/** The latex shards, from the mockup: where each flies, its turn, size and tone. */
const SHARDS = [
  { dx: -150, dy: -120, r: -260, w: 46, h: 30, tone: 'mid' },
  { dx: 150, dy: -100, r: 200, w: 40, h: 26, tone: 'hi' },
  { dx: -160, dy: 40, r: 120, w: 52, h: 34, tone: 'mid' },
  { dx: 170, dy: 60, r: -150, w: 44, h: 28, tone: 'shadow' },
  { dx: -60, dy: 170, r: 300, w: 36, h: 24, tone: 'mid' },
  { dx: 80, dy: 180, r: -320, w: 30, h: 20, tone: 'hi' },
  { dx: 20, dy: -190, r: 60, w: 28, h: 18, tone: 'mid' },
  { dx: -110, dy: 130, r: -80, w: 58, h: 38, tone: 'shadow' },
  { dx: 120, dy: 150, r: 240, w: 24, h: 16, tone: 'hi' },
] as const;
const SHARD_PATH = 'M2 20C10 4 30 0 44 8c-6 10-20 20-42 12z';

const lineIn = FadeIn.duration(Motion.state).easing(Ease.out).reduceMotion(ReduceMotion.Never);
/** Native only: on web the exit replays the line's and the mark's fade-in, so they blink. */
const newsOut = nativeOnly(
  FadeOut.duration(Motion.exit).easing(Ease.out).reduceMotion(ReduceMotion.Never),
);
/**
 * For what arrives when the beat ends: it waits until the pop news has faded,
 * because an exiting view keeps its place while the page reflows beneath it.
 * The web has no exit fade (newsOut), so there it comes in at once.
 */
export const afterBeatIn = FadeIn.duration(Motion.state)
  .delay(Platform.OS === 'web' ? 0 : Motion.exit)
  .easing(Ease.out)
  .reduceMotion(ReduceMotion.Never);

type PopNewsProps = {
  /** For example "Noah's balloon popped." */
  text: string;
  /** The quieter second line, for example "Four balloons left." */
  detail?: string;
  /** The popped seat's balloon color. */
  color: string;
  /**
   * True when the pop just happened in front of you: the sequence plays once.
   * Read on mount only, so a pop you already saw never bursts again.
   */
  animate: boolean;
  /** The chooser's own pop, already held to full: the sequence starts at the burst. */
  fromBurst?: boolean;
  /**
   * Says the pop out loud for screen readers. False for the popper's own pop,
   * which is announced once the server has confirmed it.
   */
  announce?: boolean;
};

/**
 * The pop: the one big animation in the app. The balloon swells and wobbles,
 * bursts (a flash, a ring, nine latex shards, the string drops, the stage
 * shakes), then the result rises in. With Reduce Motion it is the popped mark
 * and the lines, at once. Mount it with the popped contestant's id as key.
 */
export function PopNews({ text, detail, color, animate, fromBurst = false, announce = true }: PopNewsProps) {
  const reduced = useReduceMotion();
  const [play] = useState(animate && !reduced);
  const spoken = detail ? `${sentence(text)} ${detail}` : text;

  useEffect(() => {
    // VoiceOver has no live regions, so say both lines once when they appear.
    if (animate && announce) say(spoken);
  }, [animate, announce, spoken]);

  return (
    <Animated.View exiting={newsOut}>
      {play ? (
        <PopSequence text={text} detail={detail} color={color} fromBurst={fromBurst} announce={announce} />
      ) : (
        <>
          <View
            style={styles.markStage}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            <PoppedMark color={color} size={MARK_SIZE} />
          </View>
          <Animated.View entering={lineIn}>
            <ResultLines text={text} detail={detail} announce={announce} />
          </Animated.View>
        </>
      )}
    </Animated.View>
  );
}

function ResultLines({ text, detail, announce }: { text: string; detail?: string; announce: boolean }) {
  return (
    <View style={styles.copy}>
      <ThemedText
        type="title"
        accessibilityRole="header"
        accessibilityLiveRegion={announce ? 'polite' : 'none'}
        style={styles.center}>
        {text}
      </ThemedText>
      {detail ? (
        <ThemedText type="callout" themeColor="textSecondary" style={styles.center}>
          {detail}
        </ThemedText>
      ) : null}
    </View>
  );
}

type SequenceProps = {
  text: string;
  detail?: string;
  color: string;
  fromBurst: boolean;
  announce: boolean;
};

function PopSequence({ text, detail, color, fromBurst, announce }: SequenceProps) {
  const theme = useTheme();
  const lacquer = lacquerFor(color);
  const tones = {
    mid: color,
    hi: lacquer?.hi ?? color,
    shadow: lacquer?.shadow ?? color,
  };
  // One clock in ms for every piece. The chooser's own pop starts at the burst.
  const start = fromBurst ? BURST_AT : 0;
  const clock = useSharedValue(start);

  useEffect(() => {
    clock.set(withTiming(TIMELINE_MS, { duration: TIMELINE_MS - start, easing: Easing.linear }));
    // The custom pop haptic, at the burst.
    const id = setTimeout(() => haptics.pop(), BURST_AT - start);
    return () => clearTimeout(id);
  }, [clock, start]);

  const shake = useAnimatedStyle(() => {
    const t = clock.get() - BURST_AT;
    if (t < 0 || t > 320) return { transform: [{ translateX: 0 }] };
    const decay = 1 - t / 320;
    return { transform: [{ translateX: Math.sin(t / 18) * 4 * decay }] };
  });

  const balloon = useAnimatedStyle(() => {
    const t = clock.get();
    const p = Math.min(1, Math.max(0, (t - SWELL_AT) / SWELL_MS));
    const eased = Easing.bezierFn(0.34, 1.3, 0.64, 1)(p);
    const rotate = p < 0.5 ? -2 * (p / 0.5) : -2 + 3.5 * ((p - 0.5) / 0.5);
    return {
      opacity: t >= BURST_AT ? 0 : 1,
      transform: [{ scale: 1 + 0.24 * eased }, { rotate: `${rotate}deg` }],
    };
  });

  const string = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, (clock.get() - BURST_AT) / 1300));
    const eased = Easing.bezierFn(0.15, 0.75, 0.3, 1)(p);
    return {
      opacity: 1 - p,
      transform: [{ translateY: 420 * eased }, { rotate: `${-35 * eased}deg` }],
    };
  });

  const flash = useAnimatedStyle(() => {
    const t = clock.get() - BURST_AT;
    const p = Math.min(1, Math.max(0, t / 420));
    return { opacity: t < 0 ? 0 : 0.9 * (1 - p), transform: [{ scale: 0.3 + 1.3 * p }] };
  });

  const ring = useAnimatedStyle(() => {
    const t = clock.get() - BURST_AT;
    const p = Math.min(1, Math.max(0, t / 650));
    const eased = Easing.bezierFn(0.22, 1, 0.36, 1)(p);
    return { opacity: t < 0 ? 0 : 1 - p, transform: [{ scale: 0.5 + 2.7 * eased }] };
  });

  const lines = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, (clock.get() - TEXT_AT) / TEXT_MS));
    const eased = Easing.bezierFn(0.22, 1, 0.36, 1)(p);
    return { opacity: eased, transform: [{ translateY: 20 * (1 - eased) }] };
  });

  return (
    <Animated.View style={shake}>
      <View
        style={styles.stage}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Animated.View style={[styles.flash, flash]}>
          <Svg width={FLASH} height={FLASH}>
            <Defs>
              <RadialGradient id="popFlash" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width={FLASH} height={FLASH} fill="url(#popFlash)" />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.ring, { borderColor: theme.inverse }, ring]} />
        <Animated.View style={[styles.string, { backgroundColor: theme.gold }, string]} />
        <Animated.View style={[styles.balloon, balloon]}>
          <Balloon color={color} size={BALLOON_WIDTH} string={false} />
        </Animated.View>
        {SHARDS.map((shard, i) => (
          <Shard key={i} clock={clock} shard={shard} fill={tones[shard.tone]} />
        ))}
      </View>
      <Animated.View style={lines}>
        <ResultLines text={text} detail={detail} announce={announce} />
      </Animated.View>
    </Animated.View>
  );
}

const FLASH = 220;
/** The balloon's center on the stage. */
const CENTER_X = 0;
const CENTER_Y = 120;

function Shard({
  clock,
  shard,
  fill,
}: {
  clock: SharedValue<number>;
  shard: (typeof SHARDS)[number];
  fill: string;
}) {
  const style = useAnimatedStyle(() => {
    const t = clock.get() - BURST_AT;
    const p = Math.min(1, Math.max(0, t / 1100));
    const eased = Easing.bezierFn(0.15, 0.75, 0.3, 1)(p);
    return {
      opacity: t < 0 ? 0 : p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4,
      transform: [
        { translateX: shard.dx * eased },
        { translateY: shard.dy * eased },
        { rotate: `${shard.r * eased}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.shard,
        { width: shard.w, height: shard.h, marginLeft: CENTER_X - shard.w / 2, top: CENTER_Y - shard.h / 2 },
        style,
      ]}>
      <Svg width={shard.w} height={shard.h} viewBox="0 0 46 30">
        <Path d={SHARD_PATH} fill={fill} />
      </Svg>
    </Animated.View>
  );
}

const BALLOON_HEIGHT = (BALLOON_WIDTH * 34) / 24;

const styles = StyleSheet.create({
  stage: {
    height: STAGE_HEIGHT,
    marginTop: Space.md,
    alignItems: 'center',
  },
  markStage: {
    height: 140,
    marginTop: 20,
    paddingBottom: Space.xs,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  balloon: {
    position: 'absolute',
    top: CENTER_Y - BALLOON_HEIGHT * 0.4,
  },
  string: {
    position: 'absolute',
    top: CENTER_Y - BALLOON_HEIGHT * 0.4 + BALLOON_HEIGHT * 0.76,
    width: 1.5,
    height: STRING_LENGTH,
    transformOrigin: 'top',
  },
  flash: {
    position: 'absolute',
    top: CENTER_Y - FLASH / 2,
    width: FLASH,
    height: FLASH,
  },
  ring: {
    position: 'absolute',
    top: CENTER_Y - 50,
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
  },
  shard: {
    position: 'absolute',
    left: '50%',
  },
  copy: {
    marginTop: Space.sm,
    gap: 10,
  },
  center: {
    textAlign: 'center',
  },
});
