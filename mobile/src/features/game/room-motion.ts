import { FadeIn, FadeOut, Keyframe, LinearTransition, ReduceMotion } from 'react-native-reanimated';

import { Ease, Motion } from '@/constants/theme';
import { nativeOnly, webSafeKeyframe } from '@/utils/web-motion';

// The game room's entrances and exits. Builders live at module scope, so a
// re-render never rebuilds them.

/**
 * A row sliding into the Popped group, or into its new place. Skipped under
 * Reduce Motion, and on web, where it would stretch a row that changes size.
 */
export const cardTransition = nativeOnly(LinearTransition.duration(Motion.watch).easing(Ease.inOut));
/** The next phase arriving on the page: the picker, the question, the waiting line. */
export const phaseIn = FadeIn.duration(Motion.watch).easing(Ease.out).reduceMotion(ReduceMotion.Never);
const phaseOut = FadeOut.duration(Motion.exit).easing(Ease.out).reduceMotion(ReduceMotion.Never);
/**
 * The list fades as the picker or the cards take over. Native only: it holds rows
 * with their own entrances, which an exit on web would replay.
 */
export const listOut = nativeOnly(phaseOut);
/**
 * "Nico is picking a question…" fades as the question arrives. Native only: on web
 * the exit left the line, live region and all, in the page through the answering phase.
 */
export const pickingOut = nativeOnly(phaseOut);
/**
 * The question waits until the picking phase has gone and the rows below have
 * moved into place, so it never lands on top of either.
 */
export const questionIn = FadeIn.duration(Motion.watch)
  .delay(Motion.enter)
  .easing(Ease.out)
  .reduceMotion(ReduceMotion.Never);
/** The pop button only exists once a balloon is marked. */
export const popButtonIn = webSafeKeyframe(
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 8 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: Ease.out },
  }).duration(Motion.state),
);
export const popButtonFade = FadeIn.duration(Motion.state)
  .easing(Ease.out)
  .reduceMotion(ReduceMotion.Never);
