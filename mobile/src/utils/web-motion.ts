import { Platform } from 'react-native';
import { FadeIn, ReduceMotion, type Keyframe } from 'react-native-reanimated';

import { Ease, Motion } from '@/constants/theme';

/**
 * Workarounds for Reanimated's web build, where layout animations run as CSS
 * on the DOM and behave differently from iOS and Android. Native always gets
 * the animation it was given.
 */

/** What `new Keyframe(...)` returns, which isn't Reanimated's exported `Keyframe` type. */
type KeyframeBuilder = InstanceType<typeof Keyframe>;

/** What a keyframe entrance becomes on web: a built-in, which Reanimated leaves alone. */
const webFallback = FadeIn.duration(Motion.state).easing(Ease.out).reduceMotion(ReduceMotion.Never);

/**
 * Wrap every custom Keyframe entrance.
 *
 * On web, Reanimated schedules a cleanup 5 x (duration + delay) after a custom
 * Keyframe entrance mounts (layoutReanimation/web). It clears the view's inline
 * transform and pins it with position: absolute and fixed top, left, width,
 * height and margin from a snapshot. A view in the layout flow drops out of it
 * (a row of seats piles up, a footer loses its height), and a view with a
 * resting transform loses it (a tilted portrait straightens). Built-in
 * animations get no cleanup, so on web the entrance becomes a plain fade.
 */
export function webSafeKeyframe(keyframe: KeyframeBuilder) {
  return Platform.OS === 'web' ? webFallback : keyframe;
}

/**
 * For a layout transition or an exit that only works natively. On web, a layout
 * transition plays as a scale transform, which squashes or stretches a view that
 * changes size, and an exit re-attaches the view's children, which replays their
 * entrance fades. On web the view just moves or goes.
 */
export function nativeOnly<T>(animation: T): T | undefined {
  return Platform.OS === 'web' ? undefined : animation;
}
