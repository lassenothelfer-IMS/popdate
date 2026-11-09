import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { api } from '@/api';
import { useBalloonCheck, useBalloons } from '@/features/balloons/use-balloons';
import { useHardwareBack } from '@/hooks/use-hardware-back';
import { useT } from '@/i18n';
import { track, type Role } from '@/utils/analytics';
import { haptics } from '@/utils/haptics';
import { goHome } from '@/utils/navigation';

/** Renders nothing. While it is mounted, Android's back button runs `onBack` instead. */
export function BackAsksToLeave({ onBack }: { onBack: () => void }) {
  useHardwareBack(onBack);
  return null;
}

/** Runs a call; a failure shows `failMessage` until the next call. */
type Call = (action: () => Promise<void>, errorPhase: string | null, failMessage: string) => Promise<void>;

/**
 * The ways out of a room: Leave, with its confirmation, and Play another room.
 * `live` is false once the game ends, so a confirmation still open then does nothing.
 * `seat` is your role and the round, for analytics when you leave.
 */
export function useRoomExit(
  roomId: string,
  live: boolean,
  call: Call,
  seat: { role: Role; round: number } | null,
) {
  const t = useT();
  const balloons = useBalloons();
  const balloonCheck = useBalloonCheck();
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  /** The last leave failed: the web's leave sheet shows that error, and no older one. */
  const [leaveFailed, setLeaveFailed] = useState(false);
  const [replaying, setReplaying] = useState(false);
  /**
   * You left this room on the way to another one. If joining the queue fails
   * after that, you stay on the popped view, with "Play another room" to retry.
   */
  const [leftForReplay, setLeftForReplay] = useState(false);

  // An Alert outlives the room: once the game ends or hands off, its Leave does nothing.
  const roomLive = useRef(true);
  useEffect(() => {
    roomLive.current = live;
    return () => {
      roomLive.current = false;
    };
  }, [live]);

  async function leave() {
    if (leaving) return;
    setLeaving(true);
    setLeaveFailed(false);
    try {
      await call(() => api.leaveRoom(roomId), null, t('game.leaveFailed'));
      if (seat) track('left_mid_game', seat);
      goHome();
    } catch {
      // The error is shown above the footer, and in the web's leave sheet.
      setLeaveFailed(true);
      setLeaving(false);
    }
  }

  function confirmLeave() {
    if (!roomLive.current) return;
    haptics.medium();
    void leave();
  }

  /** Asks before leaving, with `message` saying what leaving costs you. */
  function askLeave(message: string) {
    if (leaving || replaying) return;
    // Alert does nothing on the web, so the web confirms in a sheet instead.
    if (Platform.OS === 'web') {
      setLeaveFailed(false);
      setConfirmingLeave(true);
      return;
    }
    Alert.alert(t('game.leaveTitle'), message, [
      { text: t('game.stay'), style: 'cancel' },
      { text: t('game.leave'), style: 'destructive', onPress: confirmLeave },
    ]);
  }

  async function playAgain() {
    if (replaying) return;
    setReplaying(true);
    // Your last balloon just popped: the packs first, and you stay here if you'd rather not.
    if (!(await balloonCheck(balloons))) {
      setReplaying(false);
      return;
    }
    try {
      await call(async () => {
        // A retry after the queue failed doesn't leave the room a second time.
        if (!leftForReplay) {
          await api.leaveRoom(roomId);
          setLeftForReplay(true);
        }
        await api.joinQueue();
      }, null, t('game.replayFailed'));
      track('played_again');
      router.replace('/queue');
    } catch {
      // The error is shown above the buttons.
      setReplaying(false);
    }
  }

  return {
    confirmingLeave,
    setConfirmingLeave,
    leaving,
    leaveFailed,
    replaying,
    leftForReplay,
    confirmLeave,
    askLeave,
    playAgain,
  };
}
