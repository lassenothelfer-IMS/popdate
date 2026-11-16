import { useEffect, useMemo, useState } from 'react';

import { api, type QueueStatus, type Room } from '@/api';
import { useLocale } from '@/i18n';
import { localizeQuestion } from '@/shared/questions';

/**
 * The live room, `null` if it doesn't exist, `undefined` while loading. Its
 * question and the chooser's options are in the app's language.
 */
export function useRoom(roomId: string) {
  const [room, setRoom] = useState<Room | null | undefined>(undefined);
  useEffect(() => api.watchRoom(roomId, setRoom), [roomId]);
  const locale = useLocale();
  return useMemo(() => {
    if (!room) return room;
    const local = (question: Room['questionOptions'][number]) => ({
      ...question,
      text: localizeQuestion(question.text, locale),
    });
    return {
      ...room,
      question: room.question ? local(room.question) : null,
      questionOptions: room.questionOptions.map(local),
    };
  }, [room, locale]);
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
