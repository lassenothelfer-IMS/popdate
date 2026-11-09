import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { api, type Room } from '@/api';
import { Avatar } from '@/components/avatar';
import { Balloon } from '@/components/balloon';
import { Button } from '@/components/button';
import { ErrorLine } from '@/components/error-line';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Ease, Gutter, MaxContentWidth, MinTouch, Motion, Radius, Space } from '@/constants/theme';
import { roomSeatIndex } from '@/features/game/room-seats';
import { PushPrompt } from '@/features/home/push-prompt';
import { BalloonBunch } from '@/features/queue/balloon-bunch';
import { lineClockStart, secondsSince } from '@/features/queue/line-clock';
import { RollingCount } from '@/features/queue/rolling-count';
import { useHardwareBack } from '@/hooks/use-hardware-back';
import { useQueueStatus, useRoom } from '@/hooks/use-server';
import { seatAt, useSeats, useTheme, youSeat } from '@/hooks/use-theme';
import { useT, type Translate } from '@/i18n';
import { LOBBY_SIZE, QUEUE_PING_MS } from '@/shared/limits';
import { useSession } from '@/state/session';
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
/** How long the role beat holds before the room appears. A tap skips it. */
const ROLE_BEAT_MS = 1500;
/** With a screen reader on, the beat holds long enough for the role line to be read out. */
const ROLE_BEAT_SCREEN_READER_MS = 4000;
/**
 * If the room never answers (a slow or failed watch), the room opens anyway after this.
 * The room screen has its own loading and missing states.
 */
const ROOM_WAIT_MS = ROLE_BEAT_MS * 2;
/** The role word at the count size, unless it needs less to fit on one line. */
const WORD_SIZE = 112;
/** On the web, which can't shrink text to fit: New York Light runs a little over half an em a letter. */
const WORD_EM_PER_LETTER = 0.6;

/** The role lines replace the queue lines. Opacity only, so it stays under Reduce Motion. */
const beatIn = FadeIn.duration(Motion.state).easing(Ease.out).reduceMotion(ReduceMotion.Never);

/**
 * The count and the bunch are there at once: the push already slides the
 * screen in, so they only fade up, quickly. Opacity only.
 */
const stageIn = FadeIn.duration(Motion.enter).easing(Ease.out).reduceMotion(ReduceMotion.Never);

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

/** Whether VoiceOver or TalkBack is on. Web always reports true, so it is skipped there. */
function useScreenReader() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    AccessibilityInfo.isScreenReaderEnabled().then((value) => {
      if (active) setEnabled(value);
    });
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setEnabled);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return enabled;
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
  const theme = useTheme();
  const t = useT();
  const [room, setRoom] = useState<Room | null | undefined>(undefined);
  const entered = useRef(false);
  const celebrated = useRef(false);
  const screenReader = useScreenReader();
  const holdMs = screenReader ? ROLE_BEAT_SCREEN_READER_MS : ROLE_BEAT_MS;
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

  function skipBeat() {
    if (!roomId || entered.current) return;
    entered.current = true;
    openRoom(roomId);
  }

  // Android's back button leaves the line like the button, so the queue doesn't fill a room
  // you've left. Once you're matched it does nothing: the room is on its way.
  useHardwareBack(() => void handleCancel());

  return (
    <Screen scroll contentStyle={styles.content}>
      {roomId ? <RoomWatcher roomId={roomId} onChange={setRoom} /> : null}

      {/* Once the room is full a tap anywhere opens it right away, even before it answers. */}
      <Pressable accessible={false} disabled={!roomId} onPress={skipBeat} style={styles.page}>
        <View style={styles.top}>
          {beat ? (
            <Animated.View entering={beatIn} style={styles.topLabel}>
              <ThemedText type="kicker">{t('queue.roomReady')}</ThemedText>
            </Animated.View>
          ) : (
            <>
              <Button
                title={t('queue.leaveLine')}
                variant="plain"
                fullWidth={false}
                disabled={matched}
                loading={leaving}
                onPress={() => void handleCancel()}
              />
              <View style={[styles.pill, { backgroundColor: theme.surface }]}>
                <ThemedText type="timer" style={styles.pillText}>
                  {t('queue.waited', { time: waitedLabel(waited) })}
                </ThemedText>
              </View>
            </>
          )}
        </View>
        {leaveError && !beat ? <ErrorLine message={leaveError} /> : null}

        {beat ? (
          <Animated.View key="beat" entering={beatIn} style={styles.headline}>
            <ThemedText type="question" themeColor="textSecondary" style={styles.lead}>
              {beat.lead}
            </ThemedText>
            <RoleWord word={beat.word} />
            <ThemedText type="callout" themeColor="textSecondary" style={styles.headlineLine}>
              {beat.line}
            </ThemedText>
          </Animated.View>
        ) : (
          <Animated.View entering={stageIn} style={styles.headline}>
            <View
              accessible
              accessibilityLabel={`${t('queue.seatsTaken')} ${found}. ${t('queue.countLine', { needed, people: numberWord(t, needed) })}`}
              accessibilityLiveRegion="polite"
              style={styles.headline}>
              <ThemedText type="kicker">{t('queue.seatsTaken')}</ThemedText>
              <RollingCount value={found} />
              <ThemedText type="callout" themeColor="textSecondary" style={styles.headlineLine}>
                {t('queue.countLine', { needed, people: numberWord(t, needed) })}
              </ThemedText>
            </View>
          </Animated.View>
        )}

        {beat && room ? (
          <Animated.View key="seats" entering={beatIn} style={styles.cardSlot}>
            <RoomSeats room={room} />
          </Animated.View>
        ) : (
          <Animated.View entering={stageIn} style={styles.stage}>
            <BalloonBunch found={found} needed={needed} />
            {/* The text fades in fresh on each change; the parent stays, so a screen reader's focus does too. */}
            <View accessible accessibilityLabel={statusLine}>
              <Animated.View
                key={statusLine}
                entering={beatIn}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants">
                <ThemedText type="footnote" themeColor="textTertiary" style={styles.centered}>
                  {statusLine}
                </ThemedText>
              </Animated.View>
            </View>
          </Animated.View>
        )}
        {/* Asked here, where it's useful: you can leave the app and still hear when the room opens. */}
        {beat ? null : <PushPrompt />}
      </Pressable>
    </Screen>
  );
}

/**
 * "choosing", "a balloon": as big as the line allows and never broken. iOS and
 * Android shrink it to the width; the web gets a size from the screen width instead.
 */
function RoleWord({ word }: { word: string }) {
  const { width } = useWindowDimensions();
  const line = Math.min(width, MaxContentWidth) - Gutter * 2;
  const fontSize =
    Platform.OS === 'web'
      ? Math.min(WORD_SIZE, Math.floor(line / (word.length * WORD_EM_PER_LETTER)))
      : WORD_SIZE;
  return (
    <ThemedText
      type="count"
      accessibilityRole="header"
      maxFontSizeMultiplier={1}
      allowFontScaling={false}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.3}
      style={[
        styles.centered,
        styles.word,
        fontSize < WORD_SIZE && {
          fontSize,
          lineHeight: Math.ceil(fontSize * 1.15),
          letterSpacing: -0.03 * fontSize,
        },
      ]}>
      {word}
    </ThemedText>
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

/**
 * The room once it is known: the chooser's avatar, then each balloon with its
 * holder's name, and yours labeled You.
 */
function RoomSeats({ room }: { room: Room }) {
  const theme = useTheme();
  const seats = useSeats();
  const t = useT();
  const { profile } = useSession();
  const choosing = room.me.role === 'popper';
  // Your own seat shows your own first photo, as the tab bar does, or your initial.
  const popperPhoto = choosing ? (profile?.photos[0] ?? room.popper.photos[0]) : room.popper.photos[0];
  return (
    <View
      style={[styles.card, { backgroundColor: theme.field, borderColor: theme.border }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <View style={styles.cardSeat}>
        <Avatar
          name={choosing ? (profile?.name ?? room.popper.name) : room.popper.name}
          uri={popperPhoto}
          tone={choosing ? youSeat(seats) : undefined}
          size={42}
        />
        <ThemedText type="captionStrong" numberOfLines={1}>
          {choosing ? t('common.you') : room.popper.name}
        </ThemedText>
      </View>
      {room.contestants.map((contestant, index) => {
        const mine = contestant.id === room.me.id;
        return (
          <View key={contestant.id} style={styles.cardSeat}>
            <View style={styles.cardBalloon}>
              <Balloon color={seatAt(seats, roomSeatIndex(room.contestants, index, room.me.id)).color} size={22} />
            </View>
            <ThemedText
              type={mine ? 'captionStrong' : 'caption'}
              themeColor={mine ? 'text' : 'textSecondary'}
              numberOfLines={1}>
              {mine ? t('common.you') : contestant.name}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
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
  page: {
    flexGrow: 1,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MinTouch,
  },
  topLabel: {
    minHeight: MinTouch,
    justifyContent: 'center',
  },
  pill: {
    paddingVertical: 7,
    paddingHorizontal: Space.sm,
    borderRadius: Radius.pill,
  },
  pillText: {
    fontWeight: 600,
  },
  headline: {
    alignItems: 'center',
    gap: 6,
    marginTop: 40,
  },
  word: {
    alignSelf: 'stretch',
  },
  lead: {
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
  },
  headlineLine: {
    textAlign: 'center',
    maxWidth: 300,
    marginTop: Space.xxs,
  },
  // The bunch fills the middle of the screen, with the status line under the hand.
  stage: {
    flexGrow: 1,
    gap: Space.md,
    minHeight: 260,
    marginTop: Space.lg,
    paddingBottom: Space.md,
  },
  cardSlot: {
    flexGrow: 1,
    justifyContent: 'center',
    marginTop: Space.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    minHeight: 140,
    paddingHorizontal: Space.md,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardSeat: {
    alignItems: 'center',
    gap: Space.xs,
    maxWidth: 52,
  },
  cardBalloon: {
    height: 42,
    justifyContent: 'center',
  },
});
