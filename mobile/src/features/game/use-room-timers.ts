import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import type { Room } from '@/api';
import { Motion } from '@/constants/theme';

/** How long a room may take to load before the screen offers a retry. */
const ROOM_LOAD_TIMEOUT = 12_000;

/** True once a room has taken too long to load, so the screen can offer a retry rather than spin forever. */
export function useRoomSlow(room: Room | null | undefined) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (room !== undefined) return;
    const timer = setTimeout(() => setSlow(true), ROOM_LOAD_TIMEOUT);
    return () => clearTimeout(timer);
  }, [room]);
  return slow;
}

/**
 * Opens the match once the room has one. Holds the room for a beat first, so the
 * last pop lands before the match fades in. A match that came with the last pop
 * waits for the whole pop to play.
 */
export function useMatchHandoff(room: Room | null | undefined, matchInBeat: boolean, holdMs: number) {
  const matchId = room?.matchId ?? null;
  const matchAs = room?.me.role === 'popper' ? 'popper' : 'winner';
  useEffect(() => {
    if (!matchId) return;
    const timer = setTimeout(
      () => {
        router.replace({
          pathname: '/match/[id]',
          params: { id: matchId, as: matchAs },
        });
      },
      matchInBeat ? holdMs : Motion.hold,
    );
    return () => clearTimeout(timer);
  }, [matchId, matchAs, matchInBeat, holdMs]);
}
