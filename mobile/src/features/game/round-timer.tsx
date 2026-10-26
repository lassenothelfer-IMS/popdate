import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Ease, Motion, Radius, Space } from '@/constants/theme';
import { BAR_TEXT_MAX_SCALE } from '@/features/game/room-bar';
import { formatSeconds, useSecondsLeft } from '@/hooks/use-server';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { haptics } from '@/utils/haptics';

const timerIn = FadeIn.duration(Motion.state).easing(Ease.out).reduceMotion(ReduceMotion.Never);

/** The 40 pt ring timer in the room header. */
const SIZE = 40;
const STROKE = 2.5;
const RADIUS = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** A warning haptic once, when your answer has this many seconds left. */
const WARN_AT = 10;

type RoundTimerProps = {
  deadline: number | null;
  /** The popper is over the pop time. There is no auto-pop. */
  popReminder: boolean;
  /** Buzz once at 10 s left: only while you still have an answer to send. */
  warn?: boolean;
};

/**
 * The ring timer in the room header: a 40 pt ring that empties as the clock
 * runs, the time in 11 pt tabular figures inside. It owns the per-second tick,
 * so only this ring re-renders while the clock runs. Past the pop time it
 * becomes a quiet "Everyone's waiting" pill.
 */
export function RoundTimer({ deadline, popReminder, warn = false }: RoundTimerProps) {
  const theme = useTheme();
  const t = useT();
  const secondsLeft = useSecondsLeft(deadline);
  // The ring's full length is the time left when this deadline first showed.
  const [total, setTotal] = useState<{ deadline: number | null; seconds: number } | null>(null);
  if (secondsLeft !== null && total?.deadline !== deadline) {
    setTotal({ deadline, seconds: Math.max(1, secondsLeft) });
  }
  const warned = useRef<number | null>(null);
  useEffect(() => {
    if (!warn || secondsLeft === null || deadline === null) return;
    if (secondsLeft <= WARN_AT && secondsLeft > 0 && warned.current !== deadline) {
      warned.current = deadline;
      haptics.warning();
    }
  }, [warn, secondsLeft, deadline]);

  if (popReminder) {
    const waiting = t('game.everyoneWaiting');
    return (
      <Animated.View
        entering={timerIn}
        accessible
        accessibilityRole="timer"
        accessibilityLabel={waiting}
        style={[styles.pill, { backgroundColor: theme.surface }]}>
        <ThemedText type="timer" maxFontSizeMultiplier={BAR_TEXT_MAX_SCALE} style={styles.pillText}>
          {waiting}
        </ThemedText>
      </Animated.View>
    );
  }
  if (secondsLeft === null) return null;

  const fraction = Math.min(1, secondsLeft / (total?.seconds ?? Math.max(1, secondsLeft)));
  return (
    <Animated.View
      entering={timerIn}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={t('game.secondsLeft', { count: secondsLeft })}
      style={styles.ring}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={StyleSheet.absoluteFill}>
        <Circle cx={20} cy={20} r={RADIUS} fill="none" stroke={theme.surface} strokeWidth={STROKE} />
        <Circle
          cx={20}
          cy={20}
          r={RADIUS}
          fill="none"
          stroke={theme.text}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          transform="rotate(-90 20 20)"
        />
      </Svg>
      <View>
        <ThemedText type="timer" maxFontSizeMultiplier={1} style={styles.digits}>
          {formatSeconds(secondsLeft)}
        </ThemedText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digits: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: 600,
  },
  pill: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: Space.sm,
    borderRadius: Radius.pill,
  },
  pillText: {
    fontWeight: 600,
  },
});
