import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { api } from '@/api';
import { useSession } from '@/state/session';

/** How often the count is checked while the app is open. */
const REFRESH_MS = 30_000;

/**
 * How many chats are waiting on you: they wrote last, or nobody has written yet.
 * For the badge on the Matches tab. Rechecked every 30 s and when the app comes back.
 */
export function useYourTurnCount() {
  const { profile } = useSession();
  const myId = profile?.id ?? null;
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!myId) return;
    let active = true;
    async function check() {
      try {
        const matches = await api.listMatches();
        const lasts = await Promise.all(
          matches.map((match) =>
            api
              .listMessages(match.id)
              .then((messages) => messages.at(-1) ?? null)
              .catch(() => null),
          ),
        );
        if (active) setCount(lasts.filter((last) => !last || last.senderId !== myId).length);
      } catch {
        // Keep the last count; it's only a badge.
      }
    }
    void check();
    const timer = setInterval(check, REFRESH_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => {
      active = false;
      clearInterval(timer);
      subscription.remove();
    };
  }, [myId]);

  return count;
}
