import { StyleSheet } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { CssEase, Ease, Motion, Radius, Space } from '@/constants/theme';
import { BAR_TEXT_MAX_SCALE } from '@/features/game/room-bar';
import { formatSeconds, useSecondsLeft } from '@/hooks/use-server';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

const timerIn = FadeIn.duration(Motion.state).easing(Ease.out).reduceMotion(ReduceMotion.Never);

/** Ink from 10 seconds left, and once everyone is waiting on the popper. Never red. */
const URGENT_FROM = 10;
const PILL_HEIGHT = 28;
const ICON_SIZE = 13;

type RoundTimerProps = {
  deadline: number | null;
  /** The popper is over the pop time. There is no auto-pop. */
  popReminder: boolean;
};

/**
 * The countdown pill in the room bar. It owns the per-second tick, so only this
 * pill re-renders while the clock runs, not the whole room. The digits never animate.
 */
export function RoundTimer({ deadline, popReminder }: RoundTimerProps) {
  const theme = useTheme();
  const t = useT();
  const secondsLeft = useSecondsLeft(deadline);
  if (secondsLeft === null && !popReminder) return null;

  const urgent = popReminder || (secondsLeft !== null && secondsLeft <= URGENT_FROM);
  const seconds = secondsLeft ?? 0;
  const waiting = t('game.everyoneWaiting');
  const text = popReminder ? waiting : formatSeconds(seconds);

  return (
    <Animated.View
      entering={timerIn}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={popReminder ? waiting : t('game.secondsLeft', { count: seconds })}
      style={[
        styles.pill,
        {
          backgroundColor: urgent ? theme.inverse : theme.surface,
          transitionProperty: 'backgroundColor',
          transitionDuration: Motion.state,
          transitionTimingFunction: CssEase.out,
        },
      ]}>
      <Icon name="timer" size={ICON_SIZE} color={urgent ? theme.onInverse : theme.text} />
      {/* Capped with the rest of the bar, so "Everyone's waiting" never pushes Leave off. */}
      <ThemedText
        type="timer"
        themeColor={urgent ? 'onInverse' : 'text'}
        maxFontSizeMultiplier={BAR_TEXT_MAX_SCALE}>
        {text}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: PILL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xxs,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    borderCurve: 'continuous',
  },
});
