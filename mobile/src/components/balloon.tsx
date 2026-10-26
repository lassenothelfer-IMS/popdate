import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, Keyframe, ReduceMotion } from 'react-native-reanimated';
import Svg, { Ellipse, Path } from 'react-native-svg';

import { Ease, Motion } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

/**
 * The balloon is drawn in a 24 x 34 box: a teardrop body that tapers into a
 * knot, a slack string, and one soft highlight.
 */
const VIEW_BOX = '0 0 24 34';
const BODY =
  'M12 1.5C6.2 1.5 2.5 6 2.5 11.6c0 6.4 5 11.4 8.4 12.3h2.2c3.4-.9 8.4-5.9 8.4-12.3C21.5 6 17.8 1.5 12 1.5z';
const KNOT = 'M10.4 23.6h3.2l-1.6 2.4z';
const STRING = 'M12 26c-1.4 1.8 1.4 3.2 0 5.6';
/** What a pop leaves at the knot: a ragged collar of rubber. */
const TORN = 'M8.6 23.8l.7-3.6 1.3 2 .9-3.3 1 3.3 1.3-2 .6 3.6z';
/** The middle of the body, where a pop bursts from. */
const BODY_CENTER = { x: 12, y: 12 };

/** Rendered height for a balloon of the given width. */
export function balloonHeight(size: number) {
  return (size * 34) / 24;
}

/** Lines stay about 1pt wide at list sizes and thicken a little on big marks. */
function strokePt(size: number) {
  return Math.max(0.8, 0.8 + (size - 14) * 0.0225);
}
function toUnits(points: number, size: number) {
  return (points * 24) / size;
}

type BalloonProps = {
  color: string;
  /** Width of the box in points. */
  size?: number;
  /** An outline for a seat that isn't filled yet. */
  ghost?: boolean;
  /** The slack string under the knot. Off for the brand mark and the role reveal. */
  string?: boolean;
  /** The soft highlight on the body. Off for the brand mark. */
  shine?: boolean;
};

export function Balloon({
  color,
  size = 24,
  ghost = false,
  string = true,
  shine = true,
}: BalloonProps) {
  const theme = useTheme();
  const height = balloonHeight(size);
  const line = toUnits(Math.max(1, size / 70), size);

  if (ghost) {
    return (
      <Svg width={size} height={height} viewBox={VIEW_BOX}>
        <Path d={BODY} fill="none" stroke={theme.borderStrong} strokeWidth={toUnits(1.5, size)} />
        <Path d={KNOT} fill={theme.borderStrong} />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={height} viewBox={VIEW_BOX}>
      {string ? (
        <Path d={STRING} fill="none" stroke={color} strokeOpacity={0.55} strokeWidth={line} />
      ) : null}
      <Path d={KNOT} fill={color} />
      <Path d={BODY} fill={color} />
      {shine ? (
        <Ellipse
          cx={8.2}
          cy={8}
          rx={1.8}
          ry={3}
          fill="#FFFDFA"
          fillOpacity={0.22}
          transform="rotate(-20 8.2 8)"
        />
      ) : null}
    </Svg>
  );
}

/**
 * A popped seat: a dashed ghost of the balloon with torn rubber at the knot and
 * the string still hanging. Never rays at rest, so it can't read as a spinner.
 */
export function PoppedMark({ color, size = 24 }: { color: string; size?: number }) {
  const stroke = toUnits(strokePt(size), size);
  return (
    <Svg width={size} height={balloonHeight(size)} viewBox={VIEW_BOX}>
      <Path
        d={BODY}
        fill="none"
        stroke={color}
        strokeOpacity={0.5}
        strokeWidth={stroke}
        strokeDasharray={[stroke * 1.4, stroke * 1.95]}
      />
      <Path d={TORN} fill={color} />
      <Path d={KNOT} fill={color} />
      <Path d={STRING} fill="none" stroke={color} strokeOpacity={0.6} strokeWidth={stroke * 0.9} />
    </Svg>
  );
}

/**
 * The burst, scaled from a 72pt mark: a ring the size of the body and eight
 * rounded rays, long on the axes and short on the diagonals.
 */
const RING_RADIUS = 26 / 72;
const RAYS = [0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
  const axis = angle % 90 === 0;
  const vertical = angle % 180 === 90;
  return {
    angle,
    // Measured from the canvas, per 72pt of mark.
    distance: (axis ? (vertical ? 52 : 58) : 54) / 72,
    length: (axis ? 14 : 10) / 72,
    thickness: 5 / 72,
  };
});

/**
 * The body swells about 12% and vanishes in the first 90 ms, quicker than any
 * token on purpose, then stays gone for as long as the burst is on screen. The
 * keyframes hold every piece's hidden end state themselves: a static opacity in
 * the style would fight the animation (Reanimated warns about it on device).
 */
const BURST_MS = Motion.burst + 60;
const swell = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  [Math.round((90 / BURST_MS) * 100)]: { opacity: 0, transform: [{ scale: 1.12 }], easing: Ease.out },
  100: { opacity: 0, transform: [{ scale: 1.12 }] },
}).duration(BURST_MS);

const ringOut = new Keyframe({
  0: { opacity: 0.45, transform: [{ scale: 0.7 }] },
  100: { opacity: 0, transform: [{ scale: 1.15 }], easing: Ease.out },
}).duration(BURST_MS);

function rayOut(distance: number) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateX: distance * 0.6 }] },
    30: { opacity: 1, transform: [{ translateX: distance * 0.82 }] },
    100: { opacity: 0, transform: [{ translateX: distance }], easing: Ease.out },
  }).duration(BURST_MS);
}

/** The mark settles in after the rays. Opacity only, so it is all that is left under Reduce Motion. */
const markSettles = FadeIn.duration(Motion.state).easing(Ease.out).reduceMotion(ReduceMotion.Never);

type PopBurstProps = {
  color: string;
  /** Width of the mark it settles into, in points. The burst draws outside this box. */
  size?: number;
};

/**
 * The pop, played once when it mounts: the balloon swells and vanishes, a ring
 * and eight rays in its color spring out and fade, and the popped mark stays.
 * With Reduce Motion it goes straight to the mark with a fade.
 */
export function PopBurst({ color, size = 72 }: PopBurstProps) {
  const reduced = useReduceMotion();
  const [settled, setSettled] = useState(reduced);

  useEffect(() => {
    if (reduced) return;
    // Just before the keyframes end, so no piece ever snaps back to full opacity.
    const id = setTimeout(() => setSettled(true), BURST_MS - 20);
    return () => clearTimeout(id);
  }, [reduced]);

  const height = balloonHeight(size);
  if (settled) {
    return (
      <Animated.View entering={markSettles}>
        <PoppedMark color={color} size={size} />
      </Animated.View>
    );
  }

  const cx = (BODY_CENTER.x / 24) * size;
  const cy = (BODY_CENTER.y / 34) * height;
  const radius = RING_RADIUS * size;
  return (
    <View style={{ width: size, height }}>
      <Animated.View entering={swell} style={StyleSheet.absoluteFill}>
        <Balloon color={color} size={size} string={false} />
      </Animated.View>
      <Animated.View
        entering={ringOut}
        style={[
          styles.ring,
          {
            left: cx - radius,
            top: cy - radius,
            width: radius * 2,
            height: radius * 2,
            borderRadius: radius,
            borderColor: color,
            borderWidth: Math.max(1, (1.5 / 72) * size),
          },
        ]}
      />
      {RAYS.map((ray) => {
        const length = ray.length * size;
        const thickness = Math.max(2, ray.thickness * size);
        const distance = ray.distance * size;
        return (
          // A zero-size pivot at the center, turned to the ray's angle; the ray slides out along it.
          <View
            key={ray.angle}
            style={[styles.pivot, { left: cx, top: cy, transform: [{ rotate: `${ray.angle}deg` }] }]}>
            <Animated.View
              entering={rayOut(distance)}
              style={[
                {
                  position: 'absolute',
                  left: -length / 2,
                  top: -thickness / 2,
                  width: length,
                  height: thickness,
                  borderRadius: thickness / 2,
                  backgroundColor: color,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
  },
  pivot: {
    position: 'absolute',
    width: 0,
    height: 0,
    overflow: 'visible',
  },
});
