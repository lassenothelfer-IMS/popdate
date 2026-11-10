import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Platform, StyleSheet } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { api, type Room } from '@/api';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Ease, Motion } from '@/constants/theme';
import { lineClockStart, secondsSince } from '@/features/queue/line-clock';
import { QueueStage, RoomReadyStage } from '@/features/queue/queue-stages';
import { useHardwareBack } from '@/hooks/use-hardware-back';
import { useQueueStatus, useRoom } from '@/hooks/use-server';
import { useT, type Translate } from '@/i18n';
import { LOBBY_SIZE, QUEUE_PING_MS } from '@/shared/limits';
import { track } from '@/utils/analytics';
import { haptics } from '@/utils/haptics';
import { goHome } from '@/utils/navigation';
import { setQueueInFront, setRoomOpenedByQueue } from '@/utils/push-routing';

/** How long "Now 4 of 6." stays before the line goes back to saying waiting is free. */
const CHANGE_LINE_MS = 4000;
/** A rising count ticks once (the haptics' "balloon row changes"), at most once a second. */
const TICK_GAP_MS = 1000;
/**
 * After you come back to the app, the first change of the count within this
 * long is it catching up on the time away (the server connection reopens
 * first), so it doesn't tick.
 */
const CATCH_UP_MS = 5000;
/** How long the "room is ready" countdown runs before the room opens by itself. */
const ROLE_BEAT_MS = 5000;
/**
 * If the room never answers (a slow or failed watch), the room opens anyway after this.
 * The room screen has its own loading and missing states.
 */
const ROOM_WAIT_MS = 3000;
/**
 * useQueueStatus starts as idle for one frame before the queue answers, so the
 * idle copy waits a beat instead of flashing during the push.
 */
const idleIn = FadeIn.duration(Motion.state)
  .delay(Motion.enter)
  .easing(Ease.out)
  .reduceMotion(ReduceMotion.Never);

/** The counts that have a word: `queue.number0` to `queue.number10`. */
type Spelled = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** "five" for 5, in the app's language; digits past ten. */
function numberWord(t: Translate, value: number) {
  return value >= 0 && value <= 10 ? t(`queue.number${value as Spelled}`) : String(value);
}

function capitalized(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** 0:34, 1:05: how long you have waited in line. */
function waitedLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function openRoom(roomId: string) {
  setRoomOpenedByQueue(roomId);
  router.replace({ pathname: '/room/[id]', params: { id: roomId } });
}

type RoleBeat = {
  /** "This time you're holding", over the big word. */
  lead: string;
  /** "a balloon", in the count style. */
  word: string;
  line: string;
  /** The full sentence, for screen readers. */
  spoken: string;
};

function roleBeat(room: Room, t: Translate): RoleBeat {
  const count = room.totalRounds;
  const rounds = numberWord(t, count);
  if (room.me.role === 'popper') {
    return {
      lead: t('queue.choosingLead'),
      word: t('queue.choosingWord'),
      line: t('queue.popperLine', {
        count,
        rounds,
        people: capitalized(numberWord(t, room.contestants.length)),
      }),
      spoken: t('queue.popperTitle'),
    };
  }
  return {
    lead: t('queue.holdingLead'),
    word: t('queue.holdingWord'),
    line: t('queue.contestantLine', { count, rounds, name: room.popper.name }),
    spoken: t('queue.contestantTitle'),
  };
}

export function QueueScreen() {
  const status = useQueueStatus();
  // The room size the server last sent: a found room keeps it, so the bunch doesn't change shape.
  const [lastNeeded, setLastNeeded] = useState(LOBBY_SIZE);
  if (status.state === 'searching' && status.needed !== lastNeeded) setLastNeeded(status.needed);
  const needed = status.state === 'searching' ? status.needed : lastNeeded;

  // While this screen is in front, it opens the room itself: no banner racing it.
  useFocusEffect(
    useCallback(() => {
      setQueueInFront(true);
      return () => setQueueInFront(false);
    }, []),
  );

  if (status.state === 'idle') return <NotInQueue />;

  // The same element in both states, so the balloons already in the bunch stay put.
  return (
    <FillingRoom
      found={status.state === 'searching' ? status.found : needed}
      needed={needed}
      roomId={status.state === 'matched' ? status.roomId : null}
    />
  );
}

function NotInQueue() {
  const t = useT();
  return (
    <Screen
      scroll
      footerStyle="plain"
      contentStyle={styles.content}
      footer={
        <Animated.View entering={idleIn}>
          <Button title={t('queue.backHome')} onPress={goHome} />
        </Animated.View>
      }>
      <Animated.View entering={idleIn} style={styles.idle}>
        <ThemedText type="callout" themeColor="textSecondary" style={styles.centered}>
          {t('queue.notInQueue')}
        </ThemedText>
      </Animated.View>
    </Screen>
  );
}

type FillingRoomProps = {
  found: number;
  needed: number;
  /** Set once the room is full. */
  roomId: string | null;
};

function FillingRoom({ found, needed, roomId }: FillingRoomProps) {
  const t = useT();
  const [room, setRoom] = useState<Room | null | undefined>(undefined);
  const entered = useRef(false);
  const celebrated = useRef(false);
  const holdMs = ROLE_BEAT_MS;
  // Counted from the join itself, so time with the app in the background counts too.
  const [startedAt] = useState(() => lineClockStart() ?? Date.now());
  const [waited, setWaited] = useState(() => secondsSince(startedAt));
  /** When the app last came back to the front (until the count catches up), and when it last ticked. */
  const backAt = useRef(0);
  const tickedAt = useRef(0);
  const lastFound = useRef(found);
  // Another screen over the line (a profile, Settings): no ticks or announcements meanwhile.
  const focused = useIsFocused();
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  /** When you got in line, for how long the wait took. Null if the room was already full on arrival. */
  const joinedAt = useRef<number | null>(null);
  const filled = useRef(false);

  const matched = roomId !== null;
  const beat = matched && room ? roleBeat(room, t) : null;
  const ready = matched && room !== undefined;
  const missing = room === null;

  // Which way the count last moved, for a few seconds: "Now 4 of 6." Never "joined" or
  // "left": the count is who could share a room with you, and one join can move it by five.
  const [shownFound, setShownFound] = useState(found);
  const [change, setChange] = useState<{ up: boolean } | null>(null);
  if (found !== shownFound) {
    setShownFound(found);
    setChange({ up: found > shownFound });
  }
  const statusLine = change
    ? t(change.up ? 'queue.countUp' : 'queue.countDown', { found, needed })
    : t('queue.lineFree');

  useEffect(() => {
    if (!change) return;
    const id = setTimeout(() => setChange(null), CHANGE_LINE_MS);
    return () => clearTimeout(id);
  }, [change]);

  // How long you have been in line, counting up in the pill, and right again on coming back.
  // Each tick lands just after the next whole second of the wait, so no second is skipped.
  useEffect(() => {
    if (matched) return;
    let id: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      clearTimeout(id);
      setWaited(secondsSince(startedAt));
      id = setTimeout(tick, 1000 - ((Date.now() - startedAt) % 1000) + 20);
    };
    tick();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      backAt.current = Date.now();
      tick();
    });
    return () => {
      clearTimeout(id);
      subscription.remove();
    };
  }, [matched, startedAt]);

  // A rising count ticks once with its bloom. The full room gets the success haptic instead,
  // and the first change after coming back is the count catching up, so it stays quiet.
  useEffect(() => {
    const before = lastFound.current;
    lastFound.current = found;
    if (found === before) return;
    const now = Date.now();
    const catchingUp = backAt.current !== 0 && now - backAt.current < CATCH_UP_MS;
    backAt.current = 0;
    if (matched || !focused || catchingUp || found < before) return;
    if (now - tickedAt.current < TICK_GAP_MS) return;
    tickedAt.current = now;
    haptics.selection();
  }, [found, matched, focused]);

  // Checking in while you wait, and again the moment you come back to the app: only
  // someone who checked in lately can be a room's chooser, and a place nobody checks
  // in on for ten minutes is dropped. iOS pauses the app in the background.
  useEffect(() => {
    if (matched) return;
    const ping = () => void api.pingQueue().catch(() => {});
    ping();
    const id = setInterval(ping, QUEUE_PING_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') ping();
    });
    return () => {
      clearInterval(id);
      subscription.remove();
    };
  }, [matched]);

  // The wait starts as the line opens and ends when the room fills.
  useEffect(() => {
    if (!roomId) {
      if (joinedAt.current === null) {
        joinedAt.current = Date.now();
        track('queue_joined');
      }
      return;
    }
    if (joinedAt.current === null || filled.current) return;
    filled.current = true;
    track('lobby_filled', { waitedMs: Date.now() - joinedAt.current });
  }, [roomId]);

  // The room is full: one success haptic with the role beat, then the room.
  useEffect(() => {
    if (!roomId) return;
    // From now on its "your room is open" push is ours to handle, even once the room is in front.
    setRoomOpenedByQueue(roomId);
    const enter = () => {
      if (entered.current) return;
      entered.current = true;
      openRoom(roomId);
    };
    // The room hasn't answered yet. Never wait on it forever: open it anyway.
    if (!ready) {
      const id = setTimeout(enter, ROOM_WAIT_MS);
      return () => clearTimeout(id);
    }
    // The room screen explains a room that is gone.
    if (missing) {
      enter();
      return;
    }
    if (!celebrated.current) {
      celebrated.current = true;
      haptics.success();
    }
    const id = setTimeout(enter, holdMs);
    return () => clearTimeout(id);
  }, [roomId, ready, missing, holdMs]);

  // The live region below only speaks on Android, so VoiceOver hears each change of the count.
  useEffect(() => {
    if (Platform.OS === 'ios' && focused && !matched && change) {
      AccessibilityInfo.announceForAccessibility(statusLine);
    }
  }, [focused, matched, change, statusLine]);

  // The role lines mount fresh, with no live region, so both platforms get them announced.
  const beatText = beat ? `${beat.spoken}. ${beat.line}` : null;
  useEffect(() => {
    if (beatText) AccessibilityInfo.announceForAccessibility(beatText);
  }, [beatText]);

  async function handleCancel() {
    // Once the room is full you are in it.
    if (matched || leaving) return;
    setLeaving(true);
    setLeaveError(null);
    try {
      // A room can fill in the moment you leave. You stay seated, so you go to it.
      const formed = await api.leaveQueue();
      if (formed) {
        if (joinedAt.current !== null && !filled.current) {
          filled.current = true;
          track('lobby_filled', { waitedMs: Date.now() - joinedAt.current });
        }
        if (entered.current) return;
        entered.current = true;
        openRoom(formed);
        return;
      }
      track('queue_cancelled', { waitedMs: joinedAt.current === null ? 0 : Date.now() - joinedAt.current });
      goHome();
    } catch {
      haptics.error();
      setLeaveError(t('queue.leaveFailed'));
      setLeaving(false);
    }
  }

  // Android's back button leaves the line like the button, so the queue doesn't fill a room
  // you've left. Once you're matched it does nothing: the room is on its way.
  useHardwareBack(() => void handleCancel());

  return (
    <>
      {roomId ? <RoomWatcher roomId={roomId} onChange={setRoom} /> : null}
      {beat && room ? (
        <RoomReadyStage room={room} holdMs={holdMs} />
      ) : (
        <QueueStage
          found={found}
          needed={needed}
          waited={waitedLabel(waited)}
          leaving={leaving}
          locked={matched}
          error={leaveError}
          onLeave={() => void handleCancel()}
        />
      )}
    </>
  );
}

/** Follows the room once the queue has placed you in one, and hands it up. Renders nothing. */
function RoomWatcher({
  roomId,
  onChange,
}: {
  roomId: string;
  onChange: (room: Room | null) => void;
}) {
  const room = useRoom(roomId);
  useEffect(() => {
    if (room !== undefined) onChange(room);
  }, [room, onChange]);
  return null;
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  centered: {
    textAlign: 'center',
  },
  idle: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
