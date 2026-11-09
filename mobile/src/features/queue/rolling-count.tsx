import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Ease, Motion } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

/** The old number rolls out as the new one rolls in, over this long and this far. */
const ROLL_MS = 420;
const TRAVEL = 36;

/**
 * The seat count in the count style. When it changes, the old digit rolls up
 * and out as the new one rolls in from below (the other way when it drops).
 * Under Reduce Motion the two just crossfade. Screen readers get the number
 * from the container around it, so the layers say nothing themselves.
 */
export function RollingCount({ value }: { value: number }) {
  const [shown, setShown] = useState({ value, previous: value, turn: 0 });
  if (shown.value !== value) setShown({ value, previous: shown.value, turn: shown.turn + 1 });

  if (shown.turn === 0) {
    return (
      <View style={styles.box}>
        <Digits value={shown.value} />
      </View>
    );
  }
  // A fresh roll for every change, so its first frame is drawn from its own
  // starting style (old number in place, new one hidden), never a stale one.
  return <Roll key={shown.turn} from={shown.previous} to={shown.value} />;
}

function Roll({ from, to }: { from: number; to: number }) {
  // Read once: switching Reduce Motion mid-roll only changes the next one.
  const reduceMotion = useReduceMotion();
  const [reduced] = useState(reduceMotion);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(1, { duration: reduced ? Motion.state : ROLL_MS, easing: Ease.out }));
  }, [reduced, progress]);

  const direction = to >= from ? 1 : -1;
  const travel = reduced ? 0 : TRAVEL;
  const outgoing = useAnimatedStyle(() => ({
    opacity: 1 - progress.get(),
    transform: [{ translateY: -direction * travel * progress.get() }],
  }));
  const incoming = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: direction * travel * (1 - progress.get()) }],
  }));

  return (
    <View style={styles.box}>
      <Animated.View style={[styles.under, outgoing]}>
        <Digits value={from} />
      </Animated.View>
      <Animated.View style={incoming}>
        <Digits value={to} />
      </Animated.View>
    </View>
  );
}

function Digits({ value }: { value: number }) {
  return (
    <ThemedText type="count" maxFontSizeMultiplier={1} allowFontScaling={false}>
      {value}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
  },
  under: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
