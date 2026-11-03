/**
 * The game's numbers, in one place for the app, the mock and the server
 * (`convex/lib/game.ts` re-exports them). Relative imports only: Convex
 * bundles this file without the app's `@/` alias.
 */

/** The rooms reveal one photo per round over four rounds; up to two more are optional. */
export const MIN_PHOTOS = 4;
export const MAX_PHOTOS = 6;

/** At most this many answers can be pinned to a profile. */
export const MAX_PINNED_ANSWERS = 3;

export const MAX_ANSWER_LENGTH = 280;
export const MAX_MESSAGE_LENGTH = 1000;

/** Players per room, popper included. */
export const LOBBY_SIZE = 6;
export const QUESTION_OPTIONS_PER_ROUND = 5;

/** How long the popper has to pick a question before one is picked for them. */
export const PICK_MS = 30_000;
export const ANSWER_MS = 60_000;
/**
 * Answers still land this long after the deadline players see, so clock skew or a
 * slow connection doesn't lose one sent right at the end.
 */
export const ANSWER_GRACE_MS = 3_000;
export const POP_REMINDER_MS = 30_000;
/** After the reminder, how long until a random balloon pops so the room never stalls. */
export const POP_LIMIT_MS = 30_000;

/** A runner-up can get a second chance this long after the room ends. */
export const SECOND_CHANCE_MS = 7 * 24 * 60 * 60_000;
