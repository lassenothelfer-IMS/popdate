/**
 * The live reveal: once every answer is in, the room shows the contestants one at
 * a time, answer first and then this round's photo, before the chooser pops. The
 * server works out the order and each turn's length when popping starts and sends
 * them with the room, so every phone shows the same contestant at the same moment.
 * Relative imports only: Convex bundles this file too.
 */

/** A turn's card slides into the spotlight. */
export const REVEAL_CARD_IN_MS = 400;
/** After the reading time, the photo fades in. */
export const REVEAL_PHOTO_IN_MS = 600;
/** Then the whole card holds, so the face can land. */
export const REVEAL_HOLD_MS = 1200;

/** Reading time: a base plus a quarter second a word, kept between these two. */
const READ_BASE_MS = 1500;
const READ_PER_WORD_MS = 250;
const READ_MIN_MS = 2500;
const READ_MAX_MS = 9000;
/** Someone who didn't answer gets a short turn: there is nothing to read. */
const NO_ANSWER_READ_MS = 1200;

export type RevealTurn = { id: string; ms: number };
export type Reveal = { startsAt: number; turns: RevealTurn[] };

/**
 * A pop sent this close to the reveal's end still counts: the chooser's phone
 * clock may run a little ahead of the server's.
 */
export const REVEAL_POP_TOLERANCE_MS = 1500;

/** How long the answer stays on its own before the photo comes in. */
export function revealReadMs(answer: string | null) {
  const words = answer?.trim().split(/\s+/).filter(Boolean).length ?? 0;
  if (words === 0) return NO_ANSWER_READ_MS;
  return Math.min(READ_MAX_MS, Math.max(READ_MIN_MS, READ_BASE_MS + READ_PER_WORD_MS * words));
}

/** One contestant's whole turn in the spotlight. */
export function revealTurnMs(answer: string | null) {
  return REVEAL_CARD_IN_MS + revealReadMs(answer) + REVEAL_PHOTO_IN_MS + REVEAL_HOLD_MS;
}

/** When the last turn ends and the chooser's pop time starts. */
export function revealEndsAt(reveal: Reveal) {
  return reveal.startsAt + reveal.turns.reduce((sum, turn) => sum + turn.ms, 0);
}

/**
 * The reveal without someone who left: their turn goes if it hasn't started yet,
 * and the turns after it move up. A turn already on screen plays out. Returns the
 * same reveal when nothing changes.
 */
export function revealWithout(reveal: Reveal, id: string, now: number): Reveal {
  let startsAt = reveal.startsAt;
  for (const turn of reveal.turns) {
    if (turn.id === id) {
      return startsAt > now ? { ...reveal, turns: reveal.turns.filter((t) => t.id !== id) } : reveal;
    }
    startsAt += turn.ms;
  }
  return reveal;
}

/**
 * Where the reveal is at `now`: whose turn it is, when that turn started and how
 * far into it. Before it starts, the first turn waits at 0; after the last, null.
 */
export function revealTurnAt(reveal: Reveal, now: number) {
  let startsAt = reveal.startsAt;
  for (let index = 0; index < reveal.turns.length; index++) {
    const turn = reveal.turns[index];
    if (now < startsAt + turn.ms) return { index, turn, startsAt, elapsed: Math.max(0, now - startsAt) };
    startsAt += turn.ms;
  }
  return null;
}
