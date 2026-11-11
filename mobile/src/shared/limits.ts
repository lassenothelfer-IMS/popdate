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
/**
 * The chooser's pop time is one 20-second countdown that starts after the live
 * reveal: a reminder with 8 seconds left, then a random balloon pops so the room
 * never stalls.
 */
export const POP_REMINDER_MS = 12_000;
/** After the reminder, how long until a random balloon pops. */
export const POP_LIMIT_MS = 8_000;
/**
 * The app plays a pop and then the "Round N" beat before the chooser can pick again.
 * From round 2 on the pick time starts this much later, so the beats cost nobody time.
 */
export const POP_BEAT_MS = 8_000;
/** The same for the "Answers are in" beat before the photos and the pop time. */
export const REVEAL_BEAT_MS = 2_500;

/** A runner-up can get a second chance this long after the room ends. */
export const SECOND_CHANCE_MS = 7 * 24 * 60 * 60_000;

/** While you wait in line, the app checks in this often, so the server knows you're still there. */
export const QUEUE_PING_MS = 30_000;
/**
 * Only someone who checked in this recently can be a room's chooser: the room
 * waits on the chooser, so they have to be there. iOS pauses the app in the
 * background, so a locked phone stops checking in.
 */
export const QUEUE_STALE_MS = 90_000;
/**
 * A contestant may be away this long (phone locked, another app) and still be
 * seated: the "room is ready" push brings them back. Past it, the place is dropped.
 */
export const QUEUE_AWAY_MS = 10 * 60_000;
