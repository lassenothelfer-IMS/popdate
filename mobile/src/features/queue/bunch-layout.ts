/**
 * Where each balloon sits in the queue's bunch, in a 300 x 330 design box that
 * the screen scales to fit. Every string runs down to one hand at the bottom
 * middle, so the bunch sways around that point as one thing.
 */
export const STAGE = { width: 300, height: 330 } as const;

/** The gathering point of the strings: the bottom middle of the box. */
export const HAND = { x: STAGE.width / 2, y: STAGE.height } as const;

/** A balloon's place: its middle, the top of its box, and its width. */
export type Slot = { cx: number; top: number; size: number };

/**
 * In join order: you in front in the middle, then out to each side and up, so
 * the bunch stays balanced at every count. Six at most, the biggest room.
 */
export const SLOTS: readonly Slot[] = [
  { cx: 150, top: 92, size: 88 },
  { cx: 216, top: 40, size: 66 },
  { cx: 86, top: 52, size: 62 },
  { cx: 150, top: 0, size: 58 },
  { cx: 42, top: 112, size: 54 },
  { cx: 258, top: 106, size: 58 },
];

/** Back to front: the top balloon behind everyone, yours in front of all. */
export const PAINT_ORDER: readonly number[] = [3, 4, 5, 2, 1, 0];

/** Where in its sway each balloon starts, so they never move in step. */
export const SWAY_PHASES: readonly number[] = [0, 0.37, 0.71, 0.18, 0.56, 0.86];

/** An empty seat is a smaller outline in the same place. */
export const GHOST_SCALE = 0.7;

/** The tip of the knot, where the string starts. The app's balloon box puts it at 25/24 of the width. */
export function knotOf(slot: Slot) {
  return { x: slot.cx, y: slot.top + (slot.size * 25) / 24 };
}

/**
 * Which color a seat wears: you are always the brand balloon, the next four
 * take the seat colors in join order, and a sixth would repeat the first, so
 * it gets a neutral one instead.
 */
export function seatColorOf(index: number): 'you' | number | 'neutral' {
  if (index === 0) return 'you';
  return index <= 4 ? index - 1 : 'neutral';
}

/** The largest the bunch is drawn. It is drawn at this size and only ever scaled down to fit. */
export const MAX_SCALE = 1.15;

/** How much to scale the design box to fit an area: never wider or taller than it, and at most MAX_SCALE. */
export function bunchScale(width: number, height: number) {
  if (width <= 0 || height <= 0) return 0;
  return Math.min(MAX_SCALE, width / STAGE.width, height / STAGE.height);
}

/** Balloons that arrive together bloom this far apart; ones that go shrink this far apart. */
export const BLOOM_STAGGER_MS = 120;
export const SHRINK_STAGGER_MS = 150;

/**
 * How long a seat waits before it changes when the count goes from `before`
 * to its new value: the first new balloon at once, the next ones after it,
 * and on the way down the newest one first.
 */
export function changeDelay(index: number, before: number) {
  return index >= before ? (index - before) * BLOOM_STAGGER_MS : (before - 1 - index) * SHRINK_STAGGER_MS;
}
