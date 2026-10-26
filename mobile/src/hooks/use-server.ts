import { useEffect, useState } from 'react';

import { api, type QueueStatus, type Room } from '@/api';

/** The live room, `null` if it doesn't exist, `undefined` while loading. */
export function useRoom(roomId: string) {
  const [room, setRoom] = useState<Room | null | undefined>(undefined);
  useEffect(() => api.watchRoom(roomId, setRoom), [roomId]);
  return room;
}

export function useQueueStatus() {
  const [status, setStatus] = useState<QueueStatus>({ state: 'idle' });
  useEffect(() => api.watchQueue(setStatus), []);
  return status;
}

/** Whole seconds until `deadline`, or null when there is no timer. */
export function useSecondsLeft(deadline: number | null) {
  const [now, setNow] = useState(() => Date.now());
  // Keeps ticking between timers so `now` is fresh the moment a new deadline arrives.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  if (deadline === null) return null;
  // Floor, so a `now` that is a tick old never shows more than the full time.
  return Math.max(0, Math.floor((deadline - now) / 1000));
}

export function formatSeconds(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
