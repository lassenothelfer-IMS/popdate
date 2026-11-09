import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { api } from '@/api';
import { useBalloonCheck, useBalloons } from '@/features/balloons/use-balloons';
import { useT } from '@/i18n';
import { NO_BALLOONS } from '@/shared/balloons';
import { haptics } from '@/utils/haptics';

/**
 * "Get in line": joins the queue and opens it. Shared by Home, Rooms and Matches.
 * With no balloons left it offers the balloon packs first.
 */
export function useJoinQueue() {
  const t = useT();
  const balloons = useBalloons();
  const balloonCheck = useBalloonCheck();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Back on the screen, the button is ready again.
  useFocusEffect(
    useCallback(() => {
      setJoining(false);
    }, []),
  );

  async function join() {
    if (joining) return;
    haptics.light();
    setJoining(true);
    setError(null);
    try {
      if (!(await balloonCheck(balloons))) {
        setJoining(false);
        return;
      }
      await api.joinQueue();
      router.push('/queue');
    } catch (cause) {
      // The server can still say none: a pack's balloons land a moment after the purchase.
      const message =
        cause instanceof Error && cause.message === NO_BALLOONS ? t('balloons.outTitle') : t('home.joinError');
      setError(message);
      AccessibilityInfo.announceForAccessibility(message);
      setJoining(false);
    }
  }

  return { join, joining, error, balloons };
}
