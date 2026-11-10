import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { PoppedMark } from '@/components/balloon';
import { ThemedText } from '@/components/themed-text';
import { Ease, Motion, Space } from '@/constants/theme';
import { announce as say, sentence } from '@/features/game/announce';
import { PopBurstStage } from '@/features/game/pop-burst';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { haptics } from '@/utils/haptics';
import { nativeOnly } from '@/utils/web-motion';

/** The pop's stage: the balloon floats in the middle, the burst plays around it. */
const STAGE_HEIGHT = 300;
const BALLOON_WIDTH = 110;
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
  return (own ? TIMELINE_MS - BURST_AT : TIMELINE_MS) + 2000;
}

const lineIn = FadeIn.duration(Motion.watch).easing(Ease.out).reduceMotion(ReduceMotion.Never);
/** Native only: on web the exit replays the line's and the mark's fade-in, so they blink. */
const newsOut = nativeOnly(
  FadeOut.duration(Motion.exit).easing(Ease.out).reduceMotion(ReduceMotion.Never),
);
/**
 * For what arrives when the beat ends: it waits until the pop news has faded,
 * because an exiting view keeps its place while the page reflows beneath it.
 * The web has no exit fade (newsOut), so there it comes in at once.
 */
export const afterBeatIn = FadeIn.duration(Motion.watch)
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
  // One clock in ms for every piece. The chooser's own pop starts at the burst.
  const start = fromBurst ? BURST_AT : 0;
  const clock = useSharedValue(start);

  useEffect(() => {
    clock.set(withTiming(TIMELINE_MS, { duration: TIMELINE_MS - start, easing: Easing.linear }));
    // The custom pop haptic, at the burst.
    const id = setTimeout(() => haptics.pop(), BURST_AT - start);
    return () => clearTimeout(id);
  }, [clock, start]);

  // The page takes a short knock at the burst.
  const shake = useAnimatedStyle(() => {
    const t = clock.get() - BURST_AT;
    if (t < 0 || t > 300) return { transform: [{ translateX: 0 }] };
    return { transform: [{ translateX: Math.sin(t * 0.095) * 3.2 * (1 - t / 300) }] };
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
        <View style={styles.balloon}>
          <PopBurstStage
            color={color}
            size={BALLOON_WIDTH}
            clock={clock}
            swellAt={SWELL_AT}
            swellMs={SWELL_MS}
            burstAt={BURST_AT}
          />
        </View>
      </View>
      <Animated.View style={lines}>
        <ResultLines text={text} detail={detail} announce={announce} />
      </Animated.View>
    </Animated.View>
  );
}

/** The balloon's center on the stage. */
const CENTER_Y = 120;
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
  copy: {
    marginTop: Space.sm,
    gap: 10,
  },
  center: {
    textAlign: 'center',
  },
});
