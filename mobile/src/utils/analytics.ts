/**
 * Product analytics and crash reports, with no provider picked yet.
 *
 * Every event the app records is listed in `Events` below, with its props. A
 * provider (PostHog, Sentry, EAS Observe…) plugs in through `setAnalyticsProvider`,
 * once, at startup; until then events are logged in development and dropped in
 * a release build.
 *
 * Never personal data: no names, ages, photos, answers or messages, in props or
 * in error context. Ids, counts, rounds, roles and durations only.
 */

export type Role = 'popper' | 'contestant';

/** How a room ended for you: you kept the last balloon, yours popped, you chose, or it ended with no match. */
export type RoomOutcome = 'won' | 'popped' | 'chose' | 'ended';

/** Every event and its props. Waits and durations are in milliseconds. */
export type Events = {
  queue_joined: undefined;
  lobby_filled: { waitedMs: number };
  queue_cancelled: { waitedMs: number };
  /** Sent once a round's answer time is over for a contestant still in. */
  round_answered: { round: number; answered: boolean };
  /** The chooser's own pop: how long they took once the photos were out. */
  round_popped: { round: number; msToPop: number };
  left_mid_game: { role: Role; round: number };
  room_finished: { role: Role; outcome: RoomOutcome };
  match_opened: undefined;
  first_message_sent: undefined;
  played_again: undefined;
};

export type EventName = keyof Events;

/** What a provider has to do. Each call must be cheap and must never throw. */
export type AnalyticsProvider = {
  track: (event: EventName, props?: Record<string, unknown>) => void;
  identify: (userId: string | null) => void;
  captureError: (error: unknown, context?: Record<string, unknown>) => void;
};

/** Development only: one short line per call in the console. */
const devConsole: AnalyticsProvider = {
  track: (event, props) => console.debug(`[analytics] ${event}`, props ?? ''),
  identify: (userId) => console.debug(`[analytics] identify ${userId ?? '(signed out)'}`),
  captureError: (error, context) =>
    console.debug(`[analytics] error ${error instanceof Error ? error.message : String(error)}`, context ?? ''),
};

const none: AnalyticsProvider = {
  track: () => {},
  identify: () => {},
  captureError: () => {},
};

let provider: AnalyticsProvider = __DEV__ ? devConsole : none;

/** Plugs in a real provider. The one place to change when one is chosen. */
export function setAnalyticsProvider(next: AnalyticsProvider) {
  provider = next;
}

/** Records `event`. Props are required exactly when the event has some. */
export function track<E extends EventName>(
  event: E,
  ...props: Events[E] extends undefined ? [] : [Events[E]]
) {
  try {
    provider.track(event, props[0]);
  } catch {
    // Analytics never breaks the app.
  }
}

/** Ties later events to your account id; null once you sign out. */
export function identify(userId: string | null) {
  try {
    provider.identify(userId);
  } catch {
    // Analytics never breaks the app.
  }
}

/** Reports an error the app caught, with a little context like the screen it hit. */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  try {
    provider.captureError(error, context);
  } catch {
    // Analytics never breaks the app.
  }
}
