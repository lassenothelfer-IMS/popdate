import type { Settings } from '../api/types';

/** The settings a new account starts with, on the server, in the mock and before yours load. */
export const DEFAULT_SETTINGS: Settings = {
  language: 'system',
  region: null,
  units: 'metric',
  appearance: 'light',
  commentFilter: true,
  notifications: { roomLive: true, newMatch: true, messages: true },
};
