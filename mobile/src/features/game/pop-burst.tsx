import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, Path, Polygon } from 'react-native-svg';

import {
  Balloon,
  BALLOON_BODY,
  BALLOON_KNOT,
  BALLOON_STRING_SHORT,
  BALLOON_TORN,
  balloonHeight,
  balloonInks,
} from '@/components/balloon';
import { useTheme } from '@/hooks/use-theme';

// The pop, drawn from one clock (design/balloon/pop-preview.html is the same
// motion as a page). The balloon fills from the knot and trembles; at the burst
// the rubber tears from one point on the right shoulder, the body splits into
// wedges of its own shape that snap outward, shrivel and tumble down, and the
// knot jumps and swings with the torn crown that stays. Positions are in the
// balloon's 24 x 34 box.

const KNOT_AT = { x: 12.6, y: 23.4 };
const CENTER = { x: 12.2, y: 12.2 };
/** Where the rubber gives. The tear runs from here. */
const PUNCTURE = { x: 16.4, y: 7.2 };
/** How big the balloon is when it bursts. */
const SWELLED = 1.31;

/** A fixed "random" per index, so every pop tears the same way and no frame disagrees. */
function rnd(i: number, salt = 0) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const EDGES = [-170, -128, -84, -40, 2, 44, 88, 132, 170, 190].map(
  (angle, i) => angle + (rnd(i, 3) - 0.5) * 14,
);
const TOWARD_CENTER = Math.atan2(CENTER.y - PUNCTURE.y, CENTER.x - PUNCTURE.x);

/** The wedges of rubber that meet at the puncture. */
const SCRAPS = EDGES.slice(0, -1).map((edge, i) => {
  const a0 = (edge * Math.PI) / 180;
  const a1 = (EDGES[i + 1] * Math.PI) / 180;
  const mid = (a0 + a1) / 2;
  const R = 44;
  // Roughly the middle of this wedge: further from the puncture on the far side.
  const reach = 5 + 7 * (0.5 - 0.5 * Math.cos(mid - TOWARD_CENTER + Math.PI));
  const at = { x: PUNCTURE.x + reach * Math.cos(mid), y: PUNCTURE.y + reach * Math.sin(mid) };
  return {
    points: `${PUNCTURE.x},${PUNCTURE.y} ${PUNCTURE.x + R * Math.cos(a0)},${PUNCTURE.y + R * Math.sin(a0)} ${PUNCTURE.x + R * Math.cos(a1)},${PUNCTURE.y + R * Math.sin(a1)}`,
    at,
    // Where it is as the swollen balloon bursts: the balloon grew from its knot.
    from: {
      x: KNOT_AT.x + (at.x - KNOT_AT.x) * SWELLED,
      y: KNOT_AT.y + (at.y - KNOT_AT.y) * SWELLED,
    },
    // Away from the puncture, and a little away from the middle.
    dx: Math.cos(mid) * 0.75 + (at.x - CENTER.x) * 0.045,
    dy: Math.sin(mid) * 0.75 + (at.y - CENTER.y) * 0.045,
    speed: 0.75 + rnd(i, 1) * 0.6,
    spin: (rnd(i, 2) - 0.5) * 2,
    drop: 0.7 + 0.5 * rnd(i, 9),
    /** Some scraps show the paler inside of the rubber as they turn. */
    flips: i % 3 === 1,
  };
});

/** Specks of rubber thrown straight out. */
const SPECKS = Array.from({ length: 16 }, (_, i) => ({
  angle: (i / 16) * Math.PI * 2 + (rnd(i, 5) - 0.5) * 0.5,
  far: 15 + rnd(i, 6) * 13,
  length: 0.8 + rnd(i, 7) * 1.6,
  width: 0.5 + rnd(i, 8) * 0.6,
  pale: i % 4 === 0,
}));

function clamp(value: number) {
  'worklet';
  return Math.min(1, Math.max(0, value));
}
function outCubic(p: number) {
  'worklet';
  return 1 - Math.pow(1 - clamp(p), 3);
}
function outExpo(p: number) {
  'worklet';
  return p >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(p));
}
function inOut(p: number) {
  'worklet';
  const q = clamp(p);
  return q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
}

type PopBurstStageProps = {
  /** The seat's balloon color. */
  color: string;
  /** The balloon's width in points. */
  size: number;
  /** The pop's clock in ms. */
  clock: SharedValue<number>;
  /** When the balloon starts to fill, how long it fills, and when it bursts. */
  swellAt: number;
  swellMs: number;
  burstAt: number;
};

/** The balloon and everything its pop throws out, in a box the size of the balloon. */
export function PopBurstStage({ color, size, clock, swellAt, swellMs, burstAt }: PopBurstStageProps) {
  const theme = useTheme();
  const { fill, knot, hi } = balloonInks(color, theme);
  const unit = size / 24;
  const height = balloonHeight(size);
  const center = {
    x: (KNOT_AT.x + (CENTER.x - KNOT_AT.x) * SWELLED) * unit,
    y: (KNOT_AT.y + (CENTER.y - KNOT_AT.y) * SWELLED) * unit,
  };

  // Filling up: it grows from the knot, squashes and stretches, and trembles more and more.
  const whole = useAnimatedStyle(() => {
    const ms = clock.get();
    if (ms >= burstAt) return { opacity: 0 };
    const p = clamp((ms - swellAt) / swellMs);
    const t = ms / 1000;
    const late = clamp((p - 0.8) / 0.2);
    const grow = 1 + 0.26 * inOut(p) + 0.05 * late * late;
    const wob = Math.sin(t * 17) * 0.035 * p;
    const tremble = p > 0.55 ? (p - 0.55) / 0.45 : 0;
    return {
      opacity: 1,
      transform: [
        { translateX: Math.sin(t * 71) * 0.22 * tremble * unit },
        { translateY: Math.cos(t * 83) * 0.16 * tremble * unit },
        { rotate: `${-2 * Math.sin(p * Math.PI) + 3 * p * p}deg` },
        { scaleX: grow * (1 + wob) },
        { scaleY: grow * (1 - wob) },
      ],
    };
  });

  // A blink of light, then a ring of air.
  const flash = useAnimatedStyle(() => {
    const u = (clock.get() - burstAt) / 1000;
    return {
      opacity: u >= 0 && u < 0.08 ? 0.6 * (1 - u / 0.08) : 0,
      transform: [{ scale: 1 + 4.4 * Math.max(0, u) }],
    };
  });
  const ring = useAnimatedStyle(() => {
    const u = (clock.get() - burstAt) / 1000;
    const p = clamp(u / 0.3);
    return {
      opacity: u >= 0 && u < 0.3 ? 0.35 * (1 - p) : 0,
      transform: [{ scale: 1 + 1.67 * outCubic(p) }],
    };
  });

  // The knot jumps as the rubber lets go, then hangs: the crown of torn rubber is what's left.
  const mark = useAnimatedStyle(() => {
    const u = (clock.get() - burstAt) / 1000;
    if (u < 0) return { opacity: 0 };
    const jump = u < 0.5 ? -2.6 * Math.sin(clamp(u / 0.5) * Math.PI) * (1 - u / 0.5) : 0;
    return {
      opacity: 1,
      transform: [
        { translateY: jump * unit },
        { rotate: `${Math.sin(u * 11) * 7 * Math.exp(-u * 3.2)}deg` },
        // The crown starts wide, as the torn neck, and tightens.
        { scale: 1 + 0.5 * (1 - outCubic(u / 0.35)) },
      ],
    };
  });

  const knotOrigin = { transformOrigin: [KNOT_AT.x * unit, KNOT_AT.y * unit, 0] };
  const flashSize = 27 * unit;
  const ringSize = 24 * unit;
  return (
    <View style={{ width: size, height }} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, knotOrigin, whole]}>
        <Balloon color={color} size={size} />
      </Animated.View>
      <Animated.View
        style={[
          styles.round,
          {
            left: center.x - flashSize / 2,
            top: center.y - flashSize / 2,
            width: flashSize,
            height: flashSize,
            borderRadius: flashSize / 2,
            backgroundColor: hi,
          },
          flash,
        ]}
      />
      <Animated.View
        style={[
          styles.round,
          {
            left: center.x - ringSize / 2,
            top: center.y - ringSize / 2,
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            borderWidth: Math.max(1, 0.5 * unit),
            borderColor: fill,
          },
          ring,
        ]}
      />
      {SCRAPS.map((scrap, i) => (
        <Scrap key={i} scrap={scrap} index={i} clock={clock} burstAt={burstAt} size={size} fill={fill} hi={hi} />
      ))}
      {SPECKS.map((speck, i) => (
        <Speck key={i} speck={speck} clock={clock} burstAt={burstAt} unit={unit} center={center} color={speck.pale ? hi : fill} />
      ))}
      <Animated.View style={[StyleSheet.absoluteFill, knotOrigin, mark]}>
        <Svg width={size} height={height} viewBox="0 0 24 34">
          <Path
            d={BALLOON_STRING_SHORT}
            fill="none"
            stroke={knot}
            strokeWidth={1.1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d={BALLOON_TORN} fill={fill} />
          <Path d={BALLOON_KNOT} fill={knot} />
        </Svg>
      </Animated.View>
    </View>
  );
}

type ScrapProps = {
  scrap: (typeof SCRAPS)[number];
  index: number;
  clock: SharedValue<number>;
  burstAt: number;
  size: number;
  fill: string;
  hi: string;
};

/** One wedge of rubber: thrown out, shrivelled in a blink, then tumbling down like a leaf. */
function Scrap({ scrap, index, clock, burstAt, size, fill, hi }: ScrapProps) {
  const unit = size / 24;
  const height = balloonHeight(size);
  const clip = `scrap${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const style = useAnimatedStyle(() => {
    const u = (clock.get() - burstAt) / 1000;
    if (u < 0) return { opacity: 0 };
    const snap = outExpo(u / 0.22);
    const shrivel = outCubic(u / 0.3);
    const fall = Math.max(0, u - 0.1);
    const thrown = 16 * scrap.speed * snap;
    // A flutter on the way down.
    const drift = Math.sin(fall * 5 + index) * 1.6 * clamp(fall / 0.5);
    const x = scrap.from.x + scrap.dx * thrown + drift;
    const y = scrap.from.y + scrap.dy * thrown + 34 * fall * fall * scrap.drop + 4 * fall;
    const scale = SWELLED * (1 - 0.5 * shrivel);
    // The flutter squashes the scrap, like a leaf turning.
    const turn = Math.cos(fall * 9 + index * 1.7);
    return {
      opacity: u < 0.75 ? 1 : 1 - clamp((u - 0.75) / 0.45),
      transform: [
        { translateX: (x - scrap.at.x) * unit },
        { translateY: (y - scrap.at.y) * unit },
        { rotate: `${scrap.spin * (160 * snap + 240 * fall)}deg` },
        { scaleX: scale },
        { scaleY: scale * (fall > 0.05 ? 0.35 + 0.65 * Math.abs(turn) : 1) },
      ],
    };
  });
  // The inside of the rubber is paler: it shows while the scrap is turned over.
  const inside = useAnimatedStyle(() => {
    const fall = (clock.get() - burstAt) / 1000 - 0.1;
    return { opacity: fall > 0.05 && Math.cos(fall * 9 + index * 1.7) < 0 ? 1 : 0 };
  });

  const wedge = (color: string) => (
    <Svg width={size} height={height} viewBox="0 0 24 34" style={styles.overflow}>
      <Defs>
        <ClipPath id={clip}>
          <Polygon points={scrap.points} />
        </ClipPath>
      </Defs>
      <Path d={BALLOON_BODY} fill={color} clipPath={`url(#${clip})`} />
    </Svg>
  );

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { transformOrigin: [scrap.at.x * unit, scrap.at.y * unit, 0] },
        style,
      ]}>
      {wedge(fill)}
      {scrap.flips ? (
        <Animated.View style={[StyleSheet.absoluteFill, inside]}>{wedge(hi)}</Animated.View>
      ) : null}
    </Animated.View>
  );
}

type SpeckProps = {
  speck: (typeof SPECKS)[number];
  clock: SharedValue<number>;
  burstAt: number;
  unit: number;
  center: { x: number; y: number };
  color: string;
};

/** A short streak that flies straight out and is gone. */
function Speck({ speck, clock, burstAt, unit, center, color }: SpeckProps) {
  const thickness = Math.max(1.5, speck.width * unit);
  const style = useAnimatedStyle(() => {
    const u = (clock.get() - burstAt) / 1000;
    const p = clamp(u / 0.42);
    return {
      opacity: u >= 0 && u < 0.42 ? 1 - p * p : 0,
      width: (speck.length * (1 - p) + 0.2) * unit,
      transform: [{ translateX: (9 + speck.far * outCubic(p)) * unit }],
    };
  });
  return (
    // A zero-size pivot at the middle, turned to the speck's angle; the speck slides out along it.
    <View
      style={[
        styles.pivot,
        { left: center.x, top: center.y, transform: [{ rotate: `${speck.angle}rad` }] },
      ]}>
      <Animated.View
        style={[
          { position: 'absolute', top: -thickness / 2, height: thickness, borderRadius: thickness / 2, backgroundColor: color },
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  round: {
    position: 'absolute',
  },
  pivot: {
    position: 'absolute',
    width: 0,
    height: 0,
    overflow: 'visible',
  },
  overflow: {
    overflow: 'visible',
  },
});
