import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import type { Room } from '@/api';
import { haptics } from '@/utils/haptics';

/** A failed call, and the phase it was made in. Null for leave and replay: those stay until the next call. */
type CallError = { phase: string | null; message: string };

/** The phase a call is made in. Its error shows only while the room is still there. */
export function phaseOf(room: Room) {
  return `${room.round}:${room.status}`;
}

/** The room's server calls, and the error the last one left, while it still applies. */
export function useRoomCall(room: Room | null | undefined) {
  const [error, setError] = useState<CallError | null>(null);

  /**
   * Runs a call. Its error is tied to `errorPhase`, or to none for leave and replay.
   * `failMessage` is said in the app's language, never the server's words.
   */
  async function call(action: () => Promise<void>, errorPhase: string | null, failMessage: string) {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError({ phase: errorPhase, message: failMessage });
      haptics.error();
      throw e;
    }
  }

  // A failed answer, pick or pop belongs to its phase: once the room moves on it
  // would be wrong ("Couldn't send your answer." above the next round's empty box), so
  // it goes. A failed leave or replay stays until the next call.
  const shownError =
    error && room && (error.phase === null || error.phase === phaseOf(room))
      ? error.message
      : null;

  // VoiceOver has no live regions, so say failed calls out loud.
  useEffect(() => {
    if (shownError && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(shownError);
  }, [shownError]);

  return { call, shownError };
}
