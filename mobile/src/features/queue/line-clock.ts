/**
 * When you last got in line, so the queue screen's "waited" pill counts from the
 * join itself. A clock that adds a second per tick stops while the phone has the
 * app suspended and starts over when the screen opens again.
 */
let joinedAt: number | null = null;

/** Call right after the server accepts a join. */
export function startLineClock(now = Date.now()) {
  joinedAt = now;
}

/** When you got in line, or null if nothing joined through the app this launch. */
export function lineClockStart() {
  return joinedAt;
}

/** Whole seconds since `start`, never negative. */
export function secondsSince(start: number, now = Date.now()) {
  return Math.max(0, Math.floor((now - start) / 1000));
}
