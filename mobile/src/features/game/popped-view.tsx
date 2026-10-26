import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type ViewInstance } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { balloonHeight, PopBurst, PoppedMark } from '@/components/balloon';
import { Button } from '@/components/button';
import { ErrorLine } from '@/components/error-line';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Ease, Gutter, Motion, Space } from '@/constants/theme';

const MARK_SIZE = 56;
/** The plain footer's buttons sit 6 apart, as on the canvas. */
const FOOTER_GAP = 6;
const NEXT = 'Stay to see how it ends, or try another room.';

// A kind fade instead of a one-frame swap. Opacity only, so it stays under Reduce Motion.
const contentIn = FadeIn.duration(Motion.enter).easing(Ease.out).reduceMotion(ReduceMotion.Never);

type PoppedViewProps = {
  popperName: string;
  round: number | null;
  /** Your balloon's color in the room. */
  color: string;
  /** True when your balloon popped just now: the burst plays once. Read on mount only. */
  fresh: boolean;
  /** True while you leave this room and join the queue. */
  replaying: boolean;
  /** The last failed call, shown above the buttons. */
  error: string | null;
  onPlayAgain: () => void;
  onWatch: () => void;
};

/** What a contestant sees once their balloon is popped. Deliberately no haptic. */
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
  const [burst] = useState(fresh);
  const headerRef = useRef<ViewInstance>(null);
  const line = `${popperName} popped your balloon${round ? ` in round ${round}` : ''}.`;

  // The room turns into this view inside one route, so the system posts no screen
  // change, and whatever VoiceOver was on is gone. Move it to the news once it has
  // faded in. Every time, not only after a fresh pop: a reload swaps in from the
  // loading screen the same way.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const timer = setTimeout(() => {
      if (headerRef.current) AccessibilityInfo.sendAccessibilityEvent(headerRef.current, 'focus');
    }, Motion.enter);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Screen
      scroll
      footerStyle="plain"
      contentStyle={styles.center}
      footer={
        <Animated.View entering={contentIn} style={styles.footer}>
          {error ? <ErrorLine message={error} /> : null}
          <Button title="Play another room" loading={replaying} onPress={onPlayAgain} />
          <Button title="Stay and watch" variant="ghost" disabled={replaying} onPress={onWatch} />
        </Animated.View>
      }>
      {/* The mark keeps its own box; the burst plays around it, centered on the body. */}
      <View
        style={styles.mark}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {burst ? (
          <PopBurst color={color} size={MARK_SIZE} />
        ) : (
          <PoppedMark color={color} size={MARK_SIZE} />
        )}
      </View>
      <Animated.View entering={contentIn} style={styles.copy}>
        {/* One header, so the focus lands on the whole news: who popped you, and what now. */}
        <View
          ref={headerRef}
          accessible
          accessibilityRole="header"
          accessibilityLabel={`Not this time. ${line} ${NEXT}`}
          style={styles.group}>
          <ThemedText type="display" style={styles.text}>
            Not this time
          </ThemedText>
          <ThemedText type="callout" themeColor="textSecondary" style={styles.text}>
            {line} {NEXT}
          </ThemedText>
        </View>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Centered in the space above the footer, 40 in from each side like the canvas. The
  // padding above and below leaves the burst's rays room when large text makes it scroll.
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Gutter * 2,
    paddingTop: Space.xl,
    paddingBottom: Space.xl,
  },
  mark: {
    width: MARK_SIZE,
    height: balloonHeight(MARK_SIZE),
  },
  copy: {
    marginTop: 20,
  },
  group: {
    alignItems: 'center',
    gap: Space.xs,
  },
  text: {
    textAlign: 'center',
    maxWidth: 320,
  },
  footer: {
    gap: FOOTER_GAP,
  },
});
