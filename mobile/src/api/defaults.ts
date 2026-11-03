import type { Settings } from './types';

/**
 * Rules the app, the mock and the Convex backend have to agree on. Free of app
 * imports, so `convex/` can use it too.
 */
export const MAX_ANSWER_LENGTH = 280;
export const MAX_MESSAGE_LENGTH = 1000;

export const DEFAULT_SETTINGS: Settings = {
  language: 'system',
  region: null,
  units: 'metric',
  appearance: 'dark',
  commentFilter: true,
  notifications: { roomLive: true, newMatch: true, messages: true },
};
