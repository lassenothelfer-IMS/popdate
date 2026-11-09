import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Balloon } from '@/components/balloon';
import type { Seat } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useSeats } from '@/hooks/use-theme';

/** One bob: up 6 pt and tipped 2 degrees at the middle, over 4.6 s. */
const BOB_MS = 4600;
const BOB_RISE = 6;
const BOB_TILT = 2;

type Spot = { seat: Seat['name']; size: number; left: number; top: number };

/**
 * The balloons on each pack card, in a 120 x 96 box, back to front. Placed from
 * the design's own spots, converted to the app's balloon (whose box has more
 * room under the knot).
 */
const CLUSTERS: Record<number, Spot[]> = {
  5: [spot('blush', 50, 8, 30), spot('crimson', 58, 54, 18)],
  15: [
    spot('gold', 44, 0, 36),
    spot('crimson', 58, 34, 14),
    spot('blush', 46, 74, 30),
    spot('garnet', 40, 26, 48),
  ],
  40: [
    spot('coral', 40, 0, 40),
    spot('garnet', 50, 22, 16),
    spot('gold', 44, 66, 36),
    spot('crimson', 58, 38, 28),
    spot('blush', 40, 80, 10),
  ],
};

/** Where each balloon is in its bob when the card appears, as the design staggers them. */
const PHASES = [0, 1.4 / 4.6, 2.9 / 4.6, 0.7 / 4.6, 2.1 / 4.6];

/** The design's balloon of width `width` at (left, top), as the app's Balloon with the same body. */
function spot(seat: Seat['name'], width: number, left: number, top: number): Spot {
  return {
    seat,
    size: width * 1.11,
    left: left - width * 0.058,
    top: top - width * 0.026,
  };
}

/** A few balloons that bob slowly, out of step. Still under Reduce Motion. */
export function BalloonCluster({ balloons }: { balloons: number }) {
  const seats = useSeats();
  const reduced = useReduceMotion();
  const clock = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    clock.set(withRepeat(withTiming(1, { duration: BOB_MS, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(clock);
  }, [reduced, clock]);

  const spots = CLUSTERS[balloons] ?? CLUSTERS[15];
  return (
    <View
      style={styles.box}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      {spots.map((item, index) => (
        <Bobbing
          key={index}
          clock={clock}
          phase={PHASES[index % PHASES.length]}
          still={reduced}
          style={{ left: item.left, top: item.top }}>
          <Balloon
            color={seats.find((seat) => seat.name === item.seat)?.color ?? seats[4].color}
            size={item.size}
          />
        </Bobbing>
      ))}
    </View>
  );
}

function Bobbing({
  clock,
  phase,
  still,
  style,
  children,
}: {
  clock: SharedValue<number>;
  phase: number;
  still: boolean;
  style: { left: number; top: number };
  children: ReactNode;
}) {
  const bob = useAnimatedStyle(() => {
    if (still) return { transform: [{ translateY: 0 }, { rotate: '0deg' }] };
    // 0 at rest, 1 at the top, easing in and out like the design's keyframes.
    const lift = (1 - Math.cos(2 * Math.PI * ((clock.get() + phase) % 1))) / 2;
    return {
      transform: [{ translateY: -BOB_RISE * lift }, { rotate: `${-BOB_TILT * lift}deg` }],
    };
  });
  return <Animated.View style={[styles.balloon, style, bob]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  box: {
    width: 120,
    height: 96,
  },
  balloon: {
    position: 'absolute',
    // Tips from the knot, as a balloon on a string would.
    transformOrigin: 'bottom',
  },
});
