import { useEffect, useState } from 'react';

import type { Room } from '@/api';
import { popHoldMs } from '@/features/game/pop-news';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

/**
 * The last pop that happened while this screen was open. `holding` is true
 * while the room plays the pop (popHoldMs) before the next phase. `own` is the
 * chooser's own pop, which was already held to full and starts at the burst.
 */
export type PopBeat = { id: string; holding: boolean; own: boolean };

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
  const reduced = useReduceMotion();

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
        next = { id: fresh[fresh.length - 1], holding: true, own: false };
        setKnown([...known, ...fresh]);
        setBeat(next);
      }
    }
    if (room.matchId && match?.id !== room.matchId) {
      setMatch({ id: room.matchId, inBeat: !!next?.holding });
    }
  }

  const holdingId = beat?.holding ? beat.id : null;
  const holdMs = popHoldMs(!!beat?.own, reduced);
  useEffect(() => {
    if (!holdingId) return;
    const timer = setTimeout(() => {
      setBeat((current) =>
        current?.id === holdingId ? { ...current, holding: false } : current,
      );
    }, holdMs);
    return () => clearTimeout(timer);
  }, [holdingId, holdMs]);

  /** Starts the beat on press, before the server confirms the pop. */
  function start(id: string) {
    setKnown((current) => (current && !current.includes(id) ? [...current, id] : current));
    setBeat({ id, holding: true, own: true });
  }

  /** Rolls a started beat back when the pop failed. */
  function cancel(id: string) {
    setKnown((current) => (current ? current.filter((knownId) => knownId !== id) : current));
    setBeat((current) => (current?.id === id ? null : current));
  }

  const matchInBeat = !!room?.matchId && match?.id === room.matchId && match.inBeat;
  return { beat, matchInBeat, holdMs, start, cancel };
}
