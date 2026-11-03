import { api } from '@/api';

/** How far the server's clock is ahead of this phone's, in milliseconds. */
let offset = 0;

/**
 * Asks the server for the time once, assuming the answer took half the round trip
 * to come back. Quiet on failure: the phone's own clock is the fallback.
 */
export async function syncServerClock() {
  try {
    const sent = Date.now();
    const server = await api.getServerTime();
    const received = Date.now();
    offset = server + (received - sent) / 2 - received;
  } catch {
    // Keeps the last offset. The server still decides when time is up.
  }
}

/** The time on the server's clock, for comparing with a room's deadline. */
export function serverNow() {
  return Date.now() + offset;
}
