import { useCallback, useState } from 'react';

import { api, type RoomSummary } from '@/api';
import { useTabFocus } from '@/components/tab-bar';

/**
 * The rooms you played, loaded on every visit (and each time you page to a tab
 * that shows them). Null until the first load. `reload` resolves once it's in.
 */
export function useRoomHistory() {
  const [history, setHistory] = useState<RoomSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const request = useCallback((isCurrent: () => boolean = () => true) => {
    setFailed(false);
    return api.listRoomHistory().then(
      (list) => {
        if (isCurrent()) setHistory(list);
      },
      () => {
        if (isCurrent()) setFailed(true);
      },
    );
  }, []);
  useTabFocus(
    useCallback(() => {
      let active = true;
      void request(() => active);
      return () => {
        active = false;
      };
    }, [request]),
  );
  const reload = useCallback(() => request(), [request]);
  return { history, failed, reload };
}

export type RoomStats = {
  played: number;
  /** Rooms where you were the last balloon. */
  lastBalloon: number;
  /** Rooms where you were choosing. */
  chooser: number;
  /** Days in a row, up to today or yesterday, with at least one room. */
  streak: number;
};

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Your numbers across the rooms you played. */
export function roomStats(history: readonly RoomSummary[]): RoomStats {
  const days = new Set(history.map((room) => dayKey(new Date(room.endedAt))));
  let streak = 0;
  const day = new Date();
  // A streak can still be alive if your last room was yesterday.
  if (!days.has(dayKey(day))) day.setDate(day.getDate() - 1);
  while (days.has(dayKey(day))) {
    streak += 1;
    day.setDate(day.getDate() - 1);
  }
  return {
    played: history.length,
    lastBalloon: history.filter((room) => room.outcome === 'won').length,
    chooser: history.filter((room) => room.role === 'popper').length,
    streak,
  };
}
