import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, Line, LinearGradient, Stop } from 'react-native-svg';

import { Balloon } from '@/components/balloon';
import { BrandBalloon, Ease, Motion } from '@/constants/theme';
import { YouTag } from '@/features/game/you-tag';
import {
  bunchScale,
  changeDelay,
  GHOST_SCALE,
  HAND,
  knotOf,
  MAX_SCALE,
  PAINT_ORDER,
  seatColorOf,
  SLOTS,
  STAGE,
  SWAY_PHASES,
} from '@/features/queue/bunch-layout';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { seatAt, useSeats, useTheme } from '@/hooks/use-theme';

/** One slow sway, side to side and back, around the hand. */
const SWAY_MS = 6400;
const SWAY_DEG = 1.4;
/** A new balloon blooms out of the hand with a little overshoot. */
const BLOOM_SPRING = { damping: 14, stiffness: 160 };
/** One that goes shrinks back into the hand and fades. */
const SHRINK_MS = 300;
/** Where the You pill hangs under your knot. */
const TAG_GAP = 6;

type BalloonBunchProps = {
  /** People who could share a room with you right now, you included. */
  found: number;
  /** How many a room takes. */
  needed: number;
};

/**
 * The room as it gathers: one balloon per seat on strings that meet in one hand,
 * swaying together. Yours is in front with the You pill; a seat nobody has yet
 * is a small outline. When the count rises, the new balloons bloom out of the
 * hand one after another; when it falls, the newest shrink back into it. Under
 * Reduce Motion the bunch stands still and changes with a short crossfade.
 * Decorative: the count above it carries the meaning.
 */
export function BalloonBunch({ found, needed }: BalloonBunchProps) {
  const seats = useSeats();
  const theme = useTheme();
  const reduced = useReduceMotion();
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const clock = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      cancelAnimation(clock);
      clock.set(0);
      return;
    }
    clock.set(withRepeat(withTiming(1, { duration: SWAY_MS, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(clock);
  }, [reduced, clock]);

  // The count the last change started from, so arrivals bloom in join order.
  const [counts, setCounts] = useState({ found, before: found });
  if (counts.found !== found) setCounts({ found, before: counts.found });

  function measure(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    const next = { width: Math.round(width), height: Math.round(height) };
    setArea((current) =>
      current && current.width === next.width && current.height === next.height ? current : next,
    );
  }

  const count = Math.min(needed, SLOTS.length);
  const scale = area ? bunchScale(area.width, area.height) : 0;
  const colorOf = (index: number) => {
    const seat = seatColorOf(index);
    if (seat === 'you') return BrandBalloon.color;
    if (seat === 'neutral') return theme.control;
    return seatAt(seats, seat).color;
  };

  const width = STAGE.width * MAX_SCALE;
  const height = STAGE.height * MAX_SCALE;
  return (
    <View
      style={styles.area}
      onLayout={measure}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {area && scale > 0 ? (
        <Fitted
          fit={scale / MAX_SCALE}
          still={reduced}
          style={{
            position: 'absolute',
            width,
            height,
            left: (area.width - width) / 2,
            top: (area.height - height) / 2,
          }}>
          {PAINT_ORDER.filter((index) => index < count).map((index) => (
            <Seat
              key={index}
              index={index}
              scale={MAX_SCALE}
              filled={index < found}
              delay={changeDelay(index, counts.before)}
              color={colorOf(index)}
              stringColor={theme.gold}
              clock={clock}
              still={reduced}
            />
          ))}
        </Fitted>
      ) : null}
    </View>
  );
}

/**
 * The bunch is drawn once at its largest size and fitted with one scale. It
 * starts at the right size, then eases to a new one when something below takes
 * or gives back room (the notifications card, a longer status line).
 */
function Fitted({
  fit,
  still,
  style,
  children,
}: {
  fit: number;
  still: boolean;
  style: ViewStyle;
  children: ReactNode;
}) {
  const value = useSharedValue(fit);
  useEffect(() => {
    value.set(still ? fit : withTiming(fit, { duration: Motion.enter, easing: Ease.out }));
  }, [fit, still, value]);
  const scaled = useAnimatedStyle(() => ({ transform: [{ scale: value.get() }] }));
  return <Animated.View style={[style, scaled]}>{children}</Animated.View>;
}

type SeatProps = {
  index: number;
  scale: number;
  filled: boolean;
  /** How long to wait before blooming or shrinking, when `filled` changes. */
  delay: number;
  color: string;
  stringColor: string;
  clock: SharedValue<number>;
  still: boolean;
};

/**
 * One seat: a layer the size of the bunch that sways around the hand, holding
 * the outline and, over it, the balloon on its string.
 */
function Seat({ index, scale, filled, delay, color, stringColor, clock, still }: SeatProps) {
  const slot = SLOTS[index];
  const phase = SWAY_PHASES[index];
  const fill = useSharedValue(filled ? 1 : 0);
  const target = useRef(filled ? 1 : 0);

  useEffect(() => {
    const next = filled ? 1 : 0;
    if (target.current === next) return;
    target.current = next;
    if (still) {
      fill.set(withTiming(next, { duration: Motion.state, easing: Ease.out }));
      return;
    }
    fill.set(
      withDelay(
        delay,
        next === 1
          ? withSpring(1, BLOOM_SPRING)
          : withTiming(0, { duration: SHRINK_MS, easing: Ease.out }),
      ),
    );
  }, [filled, delay, still, fill]);

  const sway = useAnimatedStyle(() => {
    const angle = still ? 0 : SWAY_DEG * Math.sin(2 * Math.PI * (clock.get() + phase));
    return { transform: [{ rotate: `${angle}deg` }] };
  });
  const bloom = useAnimatedStyle(() => {
    const value = fill.get();
    return {
      opacity: Math.min(1, Math.max(0, value * 2)),
      transform: [{ scale: still ? 1 : 0.3 + 0.7 * value }],
    };
  });
  const outline = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, Math.max(0, fill.get())),
  }));

  const size = slot.size * scale;
  const ghost = size * GHOST_SCALE;
  const knot = knotOf(slot);
  return (
    <Animated.View style={[styles.layer, sway]}>
      <Animated.View
        style={[
          styles.place,
          { left: slot.cx * scale - ghost / 2, top: (slot.top + slot.size / 2) * scale - ghost / 2 },
          outline,
        ]}>
        <Balloon color={color} size={ghost} ghost />
      </Animated.View>
      <Animated.View style={[styles.layer, bloom]}>
        <BalloonString
          from={{ x: knot.x * scale, y: knot.y * scale }}
          to={{ x: HAND.x * scale, y: HAND.y * scale }}
          color={stringColor}
        />
        <View style={[styles.place, { left: (slot.cx - slot.size / 2) * scale, top: slot.top * scale }]}>
          <Balloon color={color} size={size} />
        </View>
        {index === 0 ? (
          <View style={[styles.tag, { top: (knot.y + TAG_GAP) * scale }]}>
            <YouTag />
          </View>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

type Point = { x: number; y: number };

/** Room around the string inside its own drawing, for the stroke and its round caps. */
const STRING_PAD = 2;

/**
 * A string from the knot down to the hand, fading out before it gets there.
 * Its drawing is only as big as the string, not the whole bunch.
 */
function BalloonString({ from, to, color }: { from: Point; to: Point; color: string }) {
  // SVG ids are page-wide on the web, and url(#…) can't take the colons useId makes.
  const id = `bunchString${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const left = Math.min(from.x, to.x) - STRING_PAD;
  const top = Math.min(from.y, to.y) - STRING_PAD;
  const width = Math.abs(to.x - from.x) + STRING_PAD * 2;
  const height = Math.abs(to.y - from.y) + STRING_PAD * 2;
  const start = { x: from.x - left, y: from.y - top };
  const end = { x: to.x - left, y: to.y - top };
  return (
    <Svg width={width} height={height} style={[styles.place, { left, top }]}>
      <Defs>
        <LinearGradient
          id={id}
          gradientUnits="userSpaceOnUse"
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}>
          <Stop offset="0" stopColor={color} stopOpacity={0.9} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={`url(#${id})`}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  area: {
    flexGrow: 1,
    alignSelf: 'stretch',
    minHeight: 200,
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Turns and grows around the hand, where the strings meet.
    transformOrigin: 'bottom',
  },
  place: {
    position: 'absolute',
  },
  tag: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
