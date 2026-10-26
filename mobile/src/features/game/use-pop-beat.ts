import { useEffect, useState } from 'react';

import type { Room } from '@/api';
import { Motion } from '@/constants/theme';

/**
 * The last pop that happened while this screen was open. `holding` is true for
 * Motion.hold after it, while the room shows the pop before the next phase.
 */
export type PopBeat = { id: string; holding: boolean };

/**
 * Tells a pop you just saw from one that was already there. Pops that are in the
 * room when it first loads (a reload, or coming back with "Stay and watch") render
 * static: no burst, no beat. A pop that arrives later, or that you start yourself
 * with `start`, gets the beat. Leaving is not a pop.
 *
 * `matchInBeat` is true when the room's match arrived while a pop was still
 * holding the room: then the last pop stays on screen until the match opens.
 * A match that arrives after the beat leaves the result on screen instead.
 */
export function usePopBeat(room: Room | null | undefined) {
  const [known, setKnown] = useState<readonly string[] | null>(null);
  const [beat, setBeat] = useState<PopBeat | null>(null);
  const [match, setMatch] = useState<{ id: string; inBeat: boolean } | null>(null);

  // Adjusts state while rendering, so the frame that shows the new room data
  // already holds the beat (no flash of the next phase).
  if (room) {
    // The beat as it will be after this render, so a pop and a match that come
    // in the same update count as one moment.
    let next = beat;
    const popped = room.contestants.filter((c) => c.popped && !c.left).map((c) => c.id);
    if (known === null) {
      setKnown(popped);
    } else {
      const fresh = popped.filter((id) => !known.includes(id));
      if (fresh.length > 0) {
        next = { id: fresh[fresh.length - 1], holding: true };
        setKnown([...known, ...fresh]);
        setBeat(next);
      }
    }
    if (room.matchId && match?.id !== room.matchId) {
      setMatch({ id: room.matchId, inBeat: !!next?.holding });
    }
  }

  const holdingId = beat?.holding ? beat.id : null;
  useEffect(() => {
    if (!holdingId) return;
    const timer = setTimeout(() => {
      setBeat((current) => (current?.id === holdingId ? { id: holdingId, holding: false } : current));
    }, Motion.hold);
    return () => clearTimeout(timer);
  }, [holdingId]);

  /** Starts the beat on press, before the server confirms the pop. */
  function start(id: string) {
    setKnown((current) => (current && !current.includes(id) ? [...current, id] : current));
    setBeat({ id, holding: true });
  }

  /** Rolls a started beat back when the pop failed. */
  function cancel(id: string) {
    setKnown((current) => (current ? current.filter((knownId) => knownId !== id) : current));
    setBeat((current) => (current?.id === id ? null : current));
  }

  const matchInBeat = !!room?.matchId && match?.id === room.matchId && match.inBeat;
  return { beat, matchInBeat, start, cancel };
}
