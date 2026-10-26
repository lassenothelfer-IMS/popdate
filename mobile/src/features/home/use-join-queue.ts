import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { api } from '@/api';
import { useT } from '@/i18n';
import { haptics } from '@/utils/haptics';

/** "Get in line": joins the queue and opens it. Shared by Home and Matches. */
export function useJoinQueue() {
  const t = useT();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Back on the screen, the button is ready again.
  useFocusEffect(
    useCallback(() => {
      setJoining(false);
    }, []),
  );

  async function join() {
    haptics.light();
    setJoining(true);
    setError(null);
    try {
      await api.joinQueue();
      router.push('/queue');
    } catch {
      const message = t('home.joinError');
      setError(message);
      AccessibilityInfo.announceForAccessibility(message);
      setJoining(false);
    }
  }

  return { join, joining, error };
}
