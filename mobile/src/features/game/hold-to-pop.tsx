import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { Balloon } from '@/components/balloon';
import { Button } from '@/components/button';
import { Grain } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Gutter, Motion, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { haptics } from '@/utils/haptics';
import { useShowHints } from '@/utils/rooms-played';

/** The ring around the balloon, and how long it takes to fill while you hold. */
const RING_SIZE = 180;
const RING_STROKE = 5.4;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2 - 6;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const HOLD_MS = 2200;
/** Letting go early drains the ring. */
const DRAIN_MS = 300;
const BALLOON_WIDTH = 90;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const stageIn = FadeIn.duration(Motion.state).reduceMotion(ReduceMotion.Never);

type HoldToPopProps = {
  /** The balloon's owner, for "Hold to pop Sara". */
  name: string;
  /** Their balloon color. */
  color: string;
  /** "Round 1 of 4". */
  title: string;
  /** Held to full: the pop goes out. */
  onPop: () => void;
  /** Cancel, or Android's back button: back to the cards. */
  onCancel: () => void;
};

/**
 * The chooser's pop: hold the balloon and a 180 pt ring fills coral over
 * 2.2 s. Let go before it is full and nothing happens. At full the pop goes
 * out and the burst plays in the room. VoiceOver pops with one activate action.
 */
export function HoldToPop({ name, color, title, onPop, onCancel }: HoldToPopProps) {
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const showHints = useShowHints();
  const progress = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = useRef(false);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function pop() {
    if (done.current) return;
    done.current = true;
    if (timer.current) clearTimeout(timer.current);
    onPop();
  }

  function pressIn() {
    if (done.current) return;
    haptics.selection();
    cancelAnimation(progress);
    progress.set(withTiming(1, { duration: HOLD_MS * (1 - progress.get()), easing: Easing.linear }));
    timer.current = setTimeout(pop, HOLD_MS * (1 - progress.get()));
  }

  function pressOut() {
    if (done.current) return;
    if (timer.current) clearTimeout(timer.current);
    cancelAnimation(progress);
    progress.set(withTiming(0, { duration: DRAIN_MS, easing: Easing.out(Easing.ease) }));
  }

  const ring = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.get()),
  }));
  const balloon = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.08 * progress.get() }],
  }));

  return (
    <Animated.View
      entering={stageIn}
      accessibilityViewIsModal
      style={[StyleSheet.absoluteFill, styles.stage, { backgroundColor: theme.page, paddingTop: insets.top }]}>
      <Grain />
      <View style={styles.header}>
        <ThemedText type="headline" accessibilityRole="header">
          {title}
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {t('game.holdToPop')}
        </ThemedText>
      </View>

      <View style={styles.middle}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('game.holdToPopName', { name })}
          accessibilityHint={t('game.holdHint')}
          accessibilityActions={[{ name: 'activate' }]}
          onAccessibilityAction={pop}
          onPressIn={pressIn}
          onPressOut={pressOut}
          style={styles.target}>
          <Svg width={RING_SIZE} height={RING_SIZE} style={StyleSheet.absoluteFill}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke={theme.surface}
              strokeWidth={RING_STROKE}
            />
            <AnimatedCircle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke={theme.accent}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              animatedProps={ring}
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          </Svg>
          <Animated.View style={balloon}>
            <Balloon color={color} size={BALLOON_WIDTH * 0.62} string={false} />
          </Animated.View>
        </Pressable>
        {showHints ? (
          <ThemedText type="callout" themeColor="textSecondary" style={styles.center}>
            {t('game.holdHint')}
          </ThemedText>
        ) : null}
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Space.md) }]}>
        <Button variant="ghost" title={t('common.cancel')} onPress={onCancel} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: {
    zIndex: 10,
  },
  header: {
    paddingHorizontal: Gutter,
    paddingTop: Space.xs,
    gap: 1,
  },
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.lg,
    paddingHorizontal: Gutter,
  },
  target: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: Gutter,
  },
});
