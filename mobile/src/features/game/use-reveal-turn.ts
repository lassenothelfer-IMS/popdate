import { useEffect, useState } from 'react';

import type { Reveal } from '@/shared/reveal';
import { revealTurnAt } from '@/shared/reveal';

/**
 * Whose turn the live reveal is on, from the room's schedule and this phone's
 * clock. It wakes only when a turn ends, not on every tick. Null once the reveal
 * is over, or when there is none.
 */
export function useRevealTurn(reveal: Reveal | null) {
  const [now, setNow] = useState(() => Date.now());
  const turn = reveal ? revealTurnAt(reveal, now) : null;
  // The schedule as a string, so a fresh copy of the same room doesn't restart the timer.
  const key = reveal ? `${reveal.startsAt}:${reveal.turns.map((t) => `${t.id}/${t.ms}`).join(',')}` : null;

  const shownIndex = turn?.index ?? -1;
  useEffect(() => {
    if (!reveal) return;
    // Read against the clock as it is now. A reveal that arrived after `now` was last
    // read can show the wrong turn for a frame: that is put right at once.
    const current = revealTurnAt(reveal, Date.now());
    const wait =
      (current?.index ?? -1) !== shownIndex
        ? 0
        : current
          ? current.startsAt + current.turn.ms - Date.now()
          : null;
    if (wait === null) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, wait) + 16);
    return () => clearTimeout(timer);
    // `key` stands for `reveal`; `now` re-arms the timer after each wake.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, now, shownIndex]);

  return turn;
}
