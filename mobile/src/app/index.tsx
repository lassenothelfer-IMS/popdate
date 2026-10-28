import { Redirect, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { api } from '@/api';
import { useSession } from '@/state/session';

export default function Index() {
  const { ready, profile, onboarding } = useSession();
  // Reopened mid-room: go straight back in. Undefined while still asking.
  const [activeRoom, setActiveRoom] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!ready || !profile) return;
    let cancelled = false;
    api
      .getActiveRoom()
      .catch(() => null)
      .then((roomId) => {
        if (!cancelled) setActiveRoom(roomId);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, profile]);

  if (!ready) return null;
  if (profile) {
    if (activeRoom === undefined) return null;
    return <Redirect href={activeRoom ? (`/room/${activeRoom}` as Href) : '/home'} />;
  }
  return <Redirect href={onboarding ? '/profile-setup' : '/onboarding'} />;
}
