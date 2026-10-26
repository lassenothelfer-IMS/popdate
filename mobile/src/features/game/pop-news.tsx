import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';

import { PopBurst, PoppedMark } from '@/components/balloon';
import { ThemedText } from '@/components/themed-text';
import { Ease, Motion, Space } from '@/constants/theme';
import { announce as say, sentence } from '@/features/game/announce';
import { nativeOnly } from '@/utils/web-motion';

/** The popped mark is 72pt wide; its burst plays in a 140pt stage around it. */
const MARK_SIZE = 72;
const STAGE_HEIGHT = 140;
/** The mark stands a little off the stage's floor, so the burst centers in it. */
const STAGE_FLOOR = Space.xs;

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
  /** For example "You popped Sara's balloon". */
  text: string;
  /** The quieter second line, for example "4 balloons left". */
  detail?: string;
  /** The popped seat's hue. */
  color: string;
  /**
   * True when the pop just happened in front of you: the burst plays once.
   * Read on mount only, so a pop you already saw never bursts again.
   */
  animate: boolean;
  /**
   * Says the pop out loud for screen readers. False for the popper's own pop,
   * which is announced once the server has confirmed it.
   */
  announce?: boolean;
};

/**
 * The pop, held for a beat at the top of the room: the burst, then the popped
 * mark in the seat's hue, and the line under it. Mount it with the popped
 * contestant's id as key, so each pop gets its own burst.
 */
export function PopNews({ text, detail, color, animate, announce = true }: PopNewsProps) {
  const [burst] = useState(animate);
  const spoken = detail ? `${sentence(text)} ${detail}` : text;

  useEffect(() => {
    // VoiceOver has no live regions, so say both lines once when they appear.
    if (burst && announce) say(spoken);
  }, [burst, announce, spoken]);

  return (
    <Animated.View exiting={newsOut}>
      <View
        style={styles.stage}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {burst ? (
          <PopBurst color={color} size={MARK_SIZE} />
        ) : (
          <PoppedMark color={color} size={MARK_SIZE} />
        )}
      </View>
      <Animated.View entering={lineIn} style={styles.copy}>
        <ThemedText
          type="display"
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
      </Animated.View>
    </Animated.View>
  );
}

/** "4 balloons left", the same words during the beat and after it. */
export function balloonsLeft(count: number) {
  return count === 1 ? '1 balloon left' : `${count} balloons left`;
}

const styles = StyleSheet.create({
  stage: {
    height: STAGE_HEIGHT,
    marginTop: 20,
    paddingBottom: STAGE_FLOOR,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  copy: {
    marginTop: Space.sm,
    gap: 6,
  },
  center: {
    textAlign: 'center',
  },
});
