export const ANSWER_MS = 60_000;
/**
 * Answers still land this long after the deadline players see, so clock skew or a
 * slow connection doesn't lose one sent right at the end.
 */
export const ANSWER_GRACE_MS = 3_000;
export const POP_REMINDER_MS = 30_000;
/** How long the popper has to pick a question before one is picked for them. */
export const PICK_MS = 30_000;
/** After the reminder, how long until a random balloon pops so the room never stalls. */
export const POP_LIMIT_MS = 30_000;
export const QUESTION_OPTIONS_PER_ROUND = 5;
export const MAX_ANSWER_LENGTH = 280;
export const MAX_MESSAGE_LENGTH = 1000;

/**
 * Players per room, popper included. 6 is the real game. Set `LOBBY_SIZE` on the
 * deployment (3 to 6, e.g. `npx convex env set LOBBY_SIZE 3`) to test with fewer phones.
 */
export function lobbySize() {
  const size = Number(process.env.LOBBY_SIZE ?? 6);
  return Number.isInteger(size) && size >= 3 && size <= 6 ? size : 6;
}

export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
