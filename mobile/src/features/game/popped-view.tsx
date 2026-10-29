import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type ViewInstance } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Balloon, balloonHeight } from '@/components/balloon';
import { Button } from '@/components/button';
import { ErrorLine } from '@/components/error-line';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Ease, Motion, Space } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useT } from '@/i18n';

/** Your balloon, 90 pt wide, as it lets its air out. */
const BALLOON_WIDTH = 90;
/** The plain footer's buttons sit 6 apart, as in the mockup. */
const FOOTER_GAP = 6;
/** The balloon deflates over 1.4 s; the words rise in at 1.5 s. */
const DEFLATE_MS = 1400;
const TEXT_AT = 1500;
const TEXT_MS = 800;

// Opacity only, so it stays under Reduce Motion.
const footerIn = FadeIn.duration(Motion.enter).easing(Ease.out).reduceMotion(ReduceMotion.Never);

type PoppedViewProps = {
  popperName: string;
  round: number | null;
  /** Your balloon's color in the room. */
  color: string;
  /** True when your balloon popped just now: it deflates in front of you. Read on mount only. */
  fresh: boolean;
  /** True while you leave this room and join the queue. */
  replaying: boolean;
  /** The last failed call, shown above the buttons. */
  error: string | null;
  onPlayAgain: () => void;
  onWatch: () => void;
};

/**
 * Not this time: your balloon deflates (it squashes to a fifth and tips over),
 * then the words rise in. Deliberately no haptic. Under Reduce Motion, or when
 * you come back to it, it is already deflated.
 */
export function PoppedView({
  popperName,
  round,
  color,
  fresh,
  replaying,
  error,
  onPlayAgain,
  onWatch,
}: PoppedViewProps) {
  const t = useT();
  const reduced = useReduceMotion();
  const [play] = useState(fresh && !reduced);
  const headerRef = useRef<ViewInstance>(null);
  const line = round
    ? t('game.poppedYouInRound', { name: popperName, round })
    : t('game.poppedYou', { name: popperName });
  const next = t('game.poppedNext');
  const title = t('game.notThisTime');

  const deflate = useSharedValue(play ? 0 : 1);
  const words = useSharedValue(play ? 0 : 1);
  useEffect(() => {
    if (!play) return;
    deflate.set(withTiming(1, { duration: DEFLATE_MS, easing: Easing.bezier(0.22, 1, 0.36, 1) }));
    words.set(withDelay(TEXT_AT, withTiming(1, { duration: TEXT_MS, easing: Easing.bezier(0.22, 1, 0.36, 1) })));
  }, [play, deflate, words]);

  const balloon = useAnimatedStyle(() => {
    const p = deflate.get();
    // Through a squashed, tipped middle (scale 1.05 x .5, -6 deg at 60%) to flat and over.
    const sx = p < 0.6 ? 1 + 0.05 * (p / 0.6) : 1.05 - 0.05 * ((p - 0.6) / 0.4);
    const sy = p < 0.6 ? 1 - 0.5 * (p / 0.6) : 0.5 - 0.28 * ((p - 0.6) / 0.4);
    const rotate = p < 0.6 ? -6 * (p / 0.6) : -6 - 12 * ((p - 0.6) / 0.4);
    return { transform: [{ scaleX: sx }, { scaleY: sy }, { rotate: `${rotate}deg` }] };
  });
  const copy = useAnimatedStyle(() => ({
    opacity: words.get(),
    transform: [{ translateY: 14 * (1 - words.get()) }],
  }));

  // The room turns into this view inside one route, so the system posts no screen
  // change. Move VoiceOver to the news once it is in.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const timer = setTimeout(
      () => {
        if (headerRef.current) AccessibilityInfo.sendAccessibilityEvent(headerRef.current, 'focus');
      },
      play ? TEXT_AT : Motion.enter,
    );
    return () => clearTimeout(timer);
  }, [play]);

  return (
    <Screen
      scroll
      footerStyle="plain"
      contentStyle={styles.center}
      footer={
        <Animated.View entering={footerIn} style={styles.footer}>
          {error ? <ErrorLine message={error} /> : null}
          <Button title={t('game.playAnother')} loading={replaying} onPress={onPlayAgain} />
          <Button
            title={t('game.stayWatch')}
            variant="plain"
            disabled={replaying}
            onPress={onWatch}
          />
        </Animated.View>
      }>
      <View
        style={styles.mark}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Animated.View style={[styles.balloon, balloon]}>
          <Balloon color={color} size={BALLOON_WIDTH} string={false} />
        </Animated.View>
      </View>
      <Animated.View style={[styles.copy, copy]}>
        {/* One header, so the focus lands on the whole news: who popped you, and what now. */}
        <View
          ref={headerRef}
          accessible
          accessibilityRole="header"
          accessibilityLabel={`${title} ${line} ${next}`}
          style={styles.group}>
          <ThemedText type="title" style={styles.text}>
            {title}
          </ThemedText>
          <ThemedText type="body" themeColor="textSecondary" style={[styles.text, styles.line]}>
            {line} {next}
          </ThemedText>
        </View>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Space.xl,
    paddingBottom: Space.xl,
  },
  mark: {
    width: BALLOON_WIDTH,
    height: balloonHeight(BALLOON_WIDTH),
    justifyContent: 'flex-end',
  },
  balloon: {
    opacity: 0.9,
    transformOrigin: 'bottom',
  },
  copy: {
    marginTop: Space.lg,
  },
  group: {
    alignItems: 'center',
    gap: 10,
  },
  text: {
    textAlign: 'center',
  },
  line: {
    fontSize: 16,
    lineHeight: 22,
    maxWidth: 300,
  },
  footer: {
    gap: FOOTER_GAP,
  },
});
