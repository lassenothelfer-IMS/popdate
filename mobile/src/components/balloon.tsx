import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, Keyframe, ReduceMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { BrandBalloon, Colors, Ease, lacquerFor, Motion } from '@/constants/theme';
import { useScheme, useTheme } from '@/hooks/use-theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { mix } from '@/utils/color';

/**
 * The balloon is drawn flat in a 24 x 34 box: a round body that tapers into a
 * small knot, and one thin highlight. One color, no gradient, no string, so it
 * stays crisp from the tab bar up to the role reveal.
 */
const VIEW_BOX = '0 0 24 34';
const BODY = 'M12 2C6.8 2 3.5 6.2 3.5 11.5c0 5.9 4.5 10.9 8.5 11.7 4-.8 8.5-5.8 8.5-11.7C20.5 6.2 17.2 2 12 2z';
const KNOT = 'M10.6 23.1h2.8l-1.4 1.9z';
const HIGHLIGHT = 'M7.4 9.5c.4-2.2 1.9-3.8 3.9-4.3';
/** What a pop leaves at the knot: a ragged collar of rubber. */
const TORN = 'M8.8 23.4l.7-3.4 1.2 1.9.9-3.1.9 3.1 1.2-1.9.7 3.4z';
/** The middle of the body, where a pop bursts from. */
const BODY_CENTER = { x: 12, y: 12 };
/** Below this width the highlight is a smudge, so it is left off. */
const HIGHLIGHT_MIN = 14;
/** The highlight's width in box units: about 1 pt on a seat, thin on the hero. */
const HIGHLIGHT_WIDTH = 1.1;

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
  /** The thin highlight on the body. Off for the smallest marks. */
  shine?: boolean;
};

export function Balloon({ color, size = 24, ghost = false, shine = true }: BalloonProps) {
  const theme = useTheme();
  const height = balloonHeight(size);
  // The brand balloon (and you) wears the theme's accent, so it follows the palette.
  const fill = color.toLowerCase() === BrandBalloon.color.toLowerCase() ? theme.accent : color;

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
      <Path d={KNOT} fill={fill} />
      <Path d={BODY} fill={fill} />
      {shine && size >= HIGHLIGHT_MIN ? (
        <Path
          d={HIGHLIGHT}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity={0.4}
          strokeWidth={Math.max(HIGHLIGHT_WIDTH, toUnits(1, size))}
          strokeLinecap="round"
        />
      ) : null}
    </Svg>
  );
}

/** Relative luminance of a #RRGGBB color, as WCAG measures it. */
function luminance(hex: string) {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(value.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The contrast a popped mark should keep on the dark canvas and its cards. */
const POPPED_CONTRAST = 3;
/** The lighter of the dark page and its cards: a mark that reads there reads on both. */
const DARK_GROUND = Math.max(luminance(Colors.dark.page), luminance(Colors.dark.field));

/**
 * A seat color for a popped mark in dark mode: the deep seats (garnet, and a
 * little crimson) are mixed toward the text color until they read at about 3:1.
 * Light seats, and any ink that isn't a seat color (the recap's paper), stay as given.
 */
function poppedInk(color: string) {
  if (!lacquerFor(color)) return color;
  for (let amount = 0; amount < 1; amount += 0.05) {
    const ink = amount === 0 ? color : mix(color, Colors.dark.text, amount);
    if ((luminance(ink) + 0.05) / (DARK_GROUND + 0.05) >= POPPED_CONTRAST) return ink;
  }
  return Colors.dark.text;
}

/**
 * A popped seat: a dashed ghost of the balloon with torn rubber at the knot. Never rays at rest, so it can't read as a spinner.
 */
export function PoppedMark({ color, size = 24 }: { color: string; size?: number }) {
  const scheme = useScheme();
  const ink = scheme === 'dark' ? poppedInk(color) : color;
  const stroke = toUnits(strokePt(size), size);
  return (
    <Svg width={size} height={balloonHeight(size)} viewBox={VIEW_BOX}>
      <Path
        d={BODY}
        fill="none"
        stroke={ink}
        strokeOpacity={0.5}
        strokeWidth={stroke}
        strokeDasharray={[stroke * 1.4, stroke * 1.95]}
      />
      <Path d={TORN} fill={ink} />
      <Path d={KNOT} fill={ink} />
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
