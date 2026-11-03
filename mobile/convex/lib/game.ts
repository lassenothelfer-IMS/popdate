import { LOBBY_SIZE } from '../../src/shared/limits';

/** The game's timers and limits: the same numbers the app and the mock use. */
export {
  ANSWER_GRACE_MS,
  ANSWER_MS,
  MAX_ANSWER_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_PHOTOS,
  MAX_PINNED_ANSWERS,
  MIN_PHOTOS,
  PICK_MS,
  POP_LIMIT_MS,
  POP_REMINDER_MS,
  QUESTION_OPTIONS_PER_ROUND,
  SECOND_CHANCE_MS,
} from '../../src/shared/limits';

/**
 * Players per room, popper included. 6 is the real game. Set `LOBBY_SIZE` on the
 * deployment (3 to 6, e.g. `npx convex env set LOBBY_SIZE 3`) to test with fewer phones.
 */
export function lobbySize() {
  const size = Number(process.env.LOBBY_SIZE ?? LOBBY_SIZE);
  return Number.isInteger(size) && size >= 3 && size <= LOBBY_SIZE ? size : LOBBY_SIZE;
}

export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
