import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, Keyframe, ReduceMotion } from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';

import { BrandBalloon, Ease, lacquerFor, Motion, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

/**
 * The hand-made balloon (design/balloon/b-handmade), drawn flat in a 24 x 34 box:
 * a slightly lumpy body with a fuller right shoulder, a knot tied like a little
 * bow, one brushy highlight and a wiggly string. The body is the seat's color, the
 * knot and string its dark tone. Small marks drop the highlight and the string.
 */
const VIEW_BOX = '0 0 24 34';
const BODY =
  'M12.3 2.1C17.4 1.8 20.8 5.9 20.6 11.2C20.4 16.4 16.2 20.9 12.6 23.1C9.4 21.6 4.2 18.4 3.6 13.4C3.3 10.6 3.9 8.1 5.2 6.2C6.8 3.6 9.3 2.2 12.3 2.1z';
const KNOT =
  'M11.6 22.4L13.6 22.4L12.6 24.1zM12.6 24C12 23.2 10.7 23 10.7 24C10.7 25 11.9 24.7 12.6 24C13.3 24.9 14.9 25.2 14.8 23.9C14.7 22.8 13.2 23.2 12.6 24z';
/** A filled brush stroke, tapered at both ends. */
const HIGHLIGHT =
  'M6.5 11.8C5.9 8.6 7.5 5.6 10.5 4.5C10.9 4.4 11.1 4.8 10.8 5.1C8.7 6.5 7.6 8.8 7.6 11.6C7.6 12.3 6.6 12.4 6.5 11.8z';
const STRING = 'M12.6 24.6c-1 1.2.9 2 0 3.1s.9 2-.1 3.1s.8 1.6.2 2.6';
const STRING_SHORT = 'M12.6 24.4c-.9 1.1.8 1.8 0 2.8s.8 1.8-.1 2.8';
/** What a pop leaves at the knot: a ragged crown of rubber. */
const TORN =
  'M10.4 23.2C9.6 22.4 9.2 21.4 9.6 20.4L10.6 21.2L10.9 19.4L11.9 20.6L12.6 18.9L13.3 20.5L14.4 19.3L14.5 21L15.6 20.4C15.8 21.6 15.2 22.6 14.4 23.2L12.6 24z';
const TORN_SHINE = 'M10.6 21.2L10.9 19.4L11.9 20.6L11.3 22.4z';
/** The torn rubber, enlarged and tipped a little so it fills the box. */
const TORN_PLACE = 'translate(12 17) scale(1.5) rotate(-10) translate(-12.4 -24.5)';
/** The middle of the body, where a pop bursts from. */
const BODY_CENTER = { x: 12.2, y: 12 };
/** Below this width the highlight is a smudge, so it is left off. */
const HIGHLIGHT_MIN = 14;
/** Below this width the string is a scribble, so it is left off. */
const STRING_MIN = 20;
const SHINE_OPACITY = 0.45;

/** Rendered height for a balloon of the given width. */
export function balloonHeight(size: number) {
  return (size * 34) / 24;
}

function toUnits(points: number, size: number) {
  return (points * 24) / size;
}

/** The string: 1.1 box units, so about 1 pt on a seat, but never thicker than 4 pt on the hero. */
function stringWidth(size: number) {
  return toUnits(Math.min((1.1 * size) / 24, 4), size);
}

/** The body and the knot's colors. The brand balloon (and you) wears the brand plum. */
function inks(color: string, theme: Palette) {
  if (color.toLowerCase() === BrandBalloon.color.toLowerCase()) {
    return { fill: theme.brand, knot: theme.brandDeep };
  }
  return { fill: color, knot: lacquerFor(color)?.knot ?? color };
}

type BalloonProps = {
  color: string;
  /** Width of the box in points. */
  size?: number;
  /** An outline for a seat that isn't filled yet. */
  ghost?: boolean;
  /** The highlight on the body. Off for the smallest marks. */
  shine?: boolean;
  /** The wiggly string. Off where the screen draws its own string. */
  string?: boolean;
};

export function Balloon({ color, size = 24, ghost = false, shine = true, string = true }: BalloonProps) {
  const theme = useTheme();
  const height = balloonHeight(size);
  const { fill, knot } = inks(color, theme);

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
      {string && size >= STRING_MIN ? (
        <Path
          d={STRING}
          fill="none"
          stroke={knot}
          strokeWidth={stringWidth(size)}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      <Path d={BODY} fill={fill} />
      {shine && size >= HIGHLIGHT_MIN ? (
        <Path d={HIGHLIGHT} fill="#FFFFFF" fillOpacity={SHINE_OPACITY} />
      ) : null}
      <Path d={KNOT} fill={knot} />
    </Svg>
  );
}

/**
 * A popped seat: the torn crown of rubber left at the knot, with the bow and a
 * short string. Never rays at rest, so it can't read as a spinner.
 */
export function PoppedMark({ color, size = 24 }: { color: string; size?: number }) {
  const theme = useTheme();
  const { fill, knot } = inks(color, theme);
  return (
    <Svg width={size} height={balloonHeight(size)} viewBox={VIEW_BOX}>
      <G transform={TORN_PLACE}>
        {size >= HIGHLIGHT_MIN ? (
          <Path
            d={STRING_SHORT}
            fill="none"
            stroke={knot}
            strokeWidth={stringWidth(size) / 1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        <Path d={TORN} fill={fill} />
        {size >= HIGHLIGHT_MIN ? <Path d={TORN_SHINE} fill="#FFFFFF" fillOpacity={SHINE_OPACITY} /> : null}
        <Path d={KNOT} fill={knot} />
      </G>
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
        <Balloon color={color} size={size} />
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
