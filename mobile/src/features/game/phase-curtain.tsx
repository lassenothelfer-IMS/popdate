import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, Keyframe, ReduceMotion } from 'react-native-reanimated';

import type { Room } from '@/api';
import { ThemedText } from '@/components/themed-text';
import { Ease, Gutter, Space } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { webSafeKeyframe } from '@/utils/web-motion';

/** How long a beat holds the room. Shorter under Reduce Motion, where nothing moves. */
const CURTAIN_MS = 1800;
const CURTAIN_STILL_MS = 1100;
const IN_MS = 300;
const OUT_MS = 500;

/**
 * `round`: a new round starts, after the pop before it has played.
 * `reveal`: every answer is in and this round's photos come out.
 */
export type Curtain = { kind: 'round' | 'reveal'; round: number };

/**
 * The beats between phases: a short, quiet moment before a new round and before
 * the reveal, so one thing happens at a time. Only changes you see happen get a
 * beat: the phase the room is in when it opens shows at once, and so does a pop,
 * which holds the room itself (`holding`). The server's timers leave room for
 * these (POP_BEAT_MS, REVEAL_BEAT_MS), so nobody loses time to them.
 */
export function usePhaseCurtain(room: Room | null | undefined, holding: boolean) {
  const reduced = useReduceMotion();
  /** The round and the reveal already shown. Null until the room first loads. */
  const [seen, setSeen] = useState<{ round: number; reveal: number } | null>(null);
  const [curtain, setCurtain] = useState<Curtain | null>(null);

  const live = !!room && room.status !== 'finished';
  const round = room?.round ?? 0;
  const revealing = room?.status === 'popping';

  // The reveal adjusts state while rendering, so the frame that shows the photos
  // already has the curtain over it (no flash of what comes next).
  if (live) {
    if (seen === null) {
      setSeen({ round, reveal: revealing ? round : 0 });
    } else if (revealing && round === seen.round && seen.reveal !== round) {
      setSeen({ ...seen, reveal: round });
      setCurtain({ kind: 'reveal', round });
    }
  }

  // A new round only comes with a pop, and the pop plays first. This waits in an
  // effect, which sees the pop holding the room: a render can run before the pop
  // beat is in, and would put the round over the pop.
  const seenRound = seen?.round ?? null;
  useEffect(() => {
    if (!live || seenRound === null || round === seenRound || holding) return;
    // On the next tick, so a pop beat that lands with the new round cancels this first.
    const timer = setTimeout(() => {
      setSeen((current) => (current ? { ...current, round } : current));
      setCurtain({ kind: 'round', round });
    }, 0);
    return () => clearTimeout(timer);
  }, [live, seenRound, round, holding]);

  const key = curtain ? `${curtain.kind}:${curtain.round}` : null;
  useEffect(() => {
    if (!key) return;
    const timer = setTimeout(() => setCurtain(null), reduced ? CURTAIN_STILL_MS : CURTAIN_MS);
    return () => clearTimeout(timer);
  }, [key, reduced]);

  return curtain;
}

const curtainIn = FadeIn.duration(IN_MS).easing(Ease.out).reduceMotion(ReduceMotion.Never);
const curtainOut = FadeOut.duration(OUT_MS).easing(Ease.out).reduceMotion(ReduceMotion.Never);
/** The words rise a little as they arrive. Opacity only under Reduce Motion. */
const wordsIn = webSafeKeyframe(
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 14 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: Ease.rise },
  })
    .duration(600)
    .delay(120),
);

type PhaseCurtainProps = {
  title: string;
  /** The quieter line under it, like "4 balloons left". */
  detail?: string;
};

/**
 * The beat itself: the page color over the room's content, with one big line in
 * the middle. It fades away to show the next phase, which is that phase's entrance.
 */
export function PhaseCurtain({ title, detail }: PhaseCurtainProps) {
  const theme = useTheme();
  const reduced = useReduceMotion();
  return (
    <Animated.View
      entering={curtainIn}
      exiting={curtainOut}
      accessibilityLiveRegion="polite"
      style={[StyleSheet.absoluteFill, styles.curtain, { backgroundColor: theme.page }]}>
      <Animated.View entering={reduced ? undefined : wordsIn} style={styles.words}>
        <ThemedText type="hero" accessibilityRole="header" maxFontSizeMultiplier={1.3} style={styles.center}>
          {title}
        </ThemedText>
        {detail ? (
          <ThemedText type="body" themeColor="textSecondary" style={styles.center}>
            {detail}
          </ThemedText>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  curtain: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Gutter,
    // A little above the middle, where the eye rests on a phone.
    paddingBottom: Space.xxl,
  },
  words: {
    gap: Space.xs,
  },
  center: {
    textAlign: 'center',
  },
});
