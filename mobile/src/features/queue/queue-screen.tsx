import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  Keyframe,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { api, type Room } from '@/api';
import { Avatar } from '@/components/avatar';
import { Balloon } from '@/components/balloon';
import { Button } from '@/components/button';
import { ErrorLine } from '@/components/error-line';
import { Rise } from '@/components/rise';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { BrandBalloon, Ease, MinTouch, Motion, Radius, Space } from '@/constants/theme';
import { useHardwareBack } from '@/hooks/use-hardware-back';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useQueueStatus, useRoom } from '@/hooks/use-server';
import { seatAt, useSeats, useTheme } from '@/hooks/use-theme';
import { useT, type Translate, type TranslationKey } from '@/i18n';
import { haptics } from '@/utils/haptics';
import { PushPrompt } from '@/features/home/push-prompt';
import { goHome } from '@/utils/navigation';
import { webSafeKeyframe } from '@/utils/web-motion';

/** How long the role beat holds before the room appears. A tap skips it. */
const ROLE_BEAT_MS = 1500;
/** With a screen reader on, the beat holds long enough for the role line to be read out. */
const ROLE_BEAT_SCREEN_READER_MS = 4000;
/**
 * If the room never answers (a slow or failed watch), the room opens anyway after this.
 * The room screen has its own loading and missing states.
 */
const ROOM_WAIT_MS = ROLE_BEAT_MS * 2;
/** A seat in the row: 30 pt balloons, yours at 36. */
const SEAT = 30;
const MY_SEAT = 36;
/** The two rings behind the row: 160 pt, the second half a cycle behind the first. */
const RING = 160;
const RING_MS = 2600;
/** The join order of the balloon colors. You are crimson; the others take the rest in order. */
const OTHER_SEATS = [0, 1, 2, 3] as const;

/** A balloon rises 140 pt into its seat, growing from .6, 300 ms after the one before. */
const seatEntrances = new Map<number, InstanceType<typeof Keyframe>>();
function seatLands(delay: number) {
  let keyframe = seatEntrances.get(delay);
  if (!keyframe) {
    keyframe = new Keyframe({
      0: { opacity: 0, transform: [{ translateY: 140 }, { scale: 0.6 }] },
      100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Ease.rise },
    })
      .duration(1200)
      .delay(delay);
    seatEntrances.set(delay, keyframe);
  }
  return keyframe;
}

/** The role lines replace the queue lines. Opacity only, so it stays under Reduce Motion. */
const beatIn = FadeIn.duration(Motion.state).easing(Ease.out).reduceMotion(ReduceMotion.Never);

/**
 * useQueueStatus starts as idle for one frame before the queue answers, so the
 * idle copy waits a beat instead of flashing during the push.
 */
const idleIn = FadeIn.duration(Motion.state)
  .delay(Motion.enter)
  .easing(Ease.out)
  .reduceMotion(ReduceMotion.Never);

/** "five" for 5, in the app's language; digits past ten. */
function numberWord(t: Translate, value: number) {
  return value >= 0 && value <= 10 ? t(`queue.number${value}` as TranslationKey) : String(value);
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

  if (status.state === 'idle') return <NotInQueue />;

  // The same element in both states, so the seats that already landed stay put.
  return (
    <FillingRoom
      found={status.state === 'searching' ? status.found : status.needed}
      needed={status.needed}
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
  const [waited, setWaited] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const matched = roomId !== null;
  const beat = matched && room ? roleBeat(room, t) : null;
  const missingSeats = Math.max(needed - found, 0);
  const seatsLine =
    missingSeats === 0
      ? t('queue.seatsReady', { found, needed })
      : t('queue.seatsLine', {
          count: missingSeats,
          found,
          needed,
          missing: capitalized(numberWord(t, missingSeats)),
        });
  const ready = matched && room !== undefined;
  const missing = room === null;

  // How long you have been in line, counting up in the pill.
  useEffect(() => {
    if (matched) return;
    const id = setInterval(() => setWaited((seconds) => seconds + 1), 1000);
    return () => clearInterval(id);
  }, [matched]);

  // The room is full: one success haptic with the role beat, then the room.
  useEffect(() => {
    if (!roomId) return;
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

  // The live region below only speaks on Android, so VoiceOver gets each new player announced.
  useEffect(() => {
    if (Platform.OS === 'ios' && !matched && found > 1) {
      AccessibilityInfo.announceForAccessibility(seatsLine);
    }
  }, [matched, found, seatsLine]);

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
        if (entered.current) return;
        entered.current = true;
        openRoom(formed);
        return;
      }
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
        <Rise index={0} style={styles.top}>
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
        </Rise>
        {leaveError && !beat ? <ErrorLine message={leaveError} /> : null}

        {beat ? (
          <Animated.View key="beat" entering={beatIn} style={styles.headline}>
            <ThemedText type="question" themeColor="textSecondary" style={styles.lead}>
              {beat.lead}
            </ThemedText>
            <ThemedText
              type="count"
              accessibilityRole="header"
              maxFontSizeMultiplier={1}
              allowFontScaling={false}
              style={styles.centered}>
              {beat.word}
            </ThemedText>
            <ThemedText type="callout" themeColor="textSecondary" style={styles.headlineLine}>
              {beat.line}
            </ThemedText>
          </Animated.View>
        ) : (
          <Rise index={1} style={styles.headline}>
            <View
              accessible
              accessibilityLabel={`${t('queue.seatsTaken')} ${found}. ${t('queue.countLine', { needed, people: numberWord(t, needed) })}`}
              accessibilityLiveRegion="polite"
              style={styles.headline}>
              <ThemedText type="kicker">{t('queue.seatsTaken')}</ThemedText>
              <ThemedText type="count" maxFontSizeMultiplier={1} allowFontScaling={false}>
                {found}
              </ThemedText>
              <ThemedText type="callout" themeColor="textSecondary" style={styles.headlineLine}>
                {t('queue.countLine', { needed, people: numberWord(t, needed) })}
              </ThemedText>
            </View>
          </Rise>
        )}

        {beat && room ? (
          <Animated.View key="seats" entering={beatIn} style={styles.cardSlot}>
            <RoomSeats room={room} />
          </Animated.View>
        ) : (
          <Rise index={2} style={styles.stage}>
            <Rings />
            <SeatRow found={found} needed={needed} />
            <ThemedText type="footnote" themeColor="textTertiary" style={styles.centered}>
              {seatsLine}
            </ThemedText>
          </Rise>
        )}
        {/* Asked here, where it's useful: you can leave the app and still hear when the room opens. */}
        {beat ? null : <PushPrompt />}
      </Pressable>
    </Screen>
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

/** Two thin rings that keep expanding out of the row and fading, half a cycle apart. */
function Rings() {
  return (
    <View
      style={styles.rings}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Ring delay={0} />
      <Ring delay={RING_MS / 2} />
    </View>
  );
}

function Ring({ delay }: { delay: number }) {
  const theme = useTheme();
  const reduced = useReduceMotion();
  const grow = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      cancelAnimation(grow);
      grow.set(0);
      return;
    }
    grow.set(
      withDelay(
        delay,
        withRepeat(withTiming(1, { duration: RING_MS, easing: Easing.bezier(0.2, 0.7, 0.3, 1) }), -1),
      ),
    );
  }, [reduced, delay, grow]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.35 * (0.55 - 0.55 * grow.get()),
    transform: [{ scale: 0.6 + 1.3 * grow.get() }],
  }));
  if (reduced) return null;
  return <Animated.View style={[styles.ring, { borderColor: theme.text }, style]} />;
}

/**
 * Every seat in the room as a balloon: yours in crimson and a little bigger,
 * the people already here in join order, and a dashed ghost for each seat
 * still empty. Decorative: the count above carries the meaning.
 */
function SeatRow({ found, needed }: { found: number; needed: number }) {
  const seats = useSeats();
  const reduced = useReduceMotion();
  // The seats already filled when the screen opens rise in one after another; later ones rise as they arrive.
  const [initial] = useState(found);
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: needed }, (_, index) => {
        const filled = index < found;
        if (!filled) return <GhostSeat key={`ghost-${index}`} />;
        const mine = index === 0;
        const color = mine ? BrandBalloon.color : seatAt(seats, OTHER_SEATS[(index - 1) % OTHER_SEATS.length]).color;
        const delay = index < initial ? index * 300 : 0;
        return (
          <Animated.View
            key={`seat-${index}`}
            entering={reduced ? undefined : webSafeKeyframe(seatLands(delay))}>
            <Balloon color={color} size={mine ? MY_SEAT : SEAT} />
          </Animated.View>
        );
      })}
    </View>
  );
}

/** An empty seat: a dashed balloon outline that pulses softly while it waits. */
function GhostSeat() {
  const theme = useTheme();
  const reduced = useReduceMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      cancelAnimation(pulse);
      pulse.set(0.5);
      return;
    }
    pulse.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }), -1, true));
  }, [reduced, pulse]);
  // .25 to .55 of a border that is itself the text color at half strength.
  const style = useAnimatedStyle(() => ({ opacity: 0.5 * (0.25 + 0.3 * pulse.get()) }));
  return <Animated.View style={[styles.ghost, { borderColor: theme.text }, style]} />;
}

/**
 * The room once it is known: the chooser's avatar, then each balloon with its
 * holder's name, and yours labeled You.
 */
function RoomSeats({ room }: { room: Room }) {
  const theme = useTheme();
  const seats = useSeats();
  const t = useT();
  return (
    <View
      style={[styles.card, { backgroundColor: theme.field, borderColor: theme.border }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <View style={styles.cardSeat}>
        <Avatar name={room.popper.name} uri={room.popper.photos[0]} size={42} />
        <ThemedText type="captionStrong" numberOfLines={1}>
          {room.me.role === 'popper' ? t('common.you') : room.popper.name}
        </ThemedText>
      </View>
      {room.contestants.map((contestant, index) => {
        const mine = contestant.id === room.me.id;
        return (
          <View key={contestant.id} style={styles.cardSeat}>
            <View style={styles.cardBalloon}>
              <Balloon color={seatAt(seats, index).color} size={22} />
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
  // The rings and the row, in the lit middle of the screen.
  stage: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 72,
    minHeight: 260,
    marginTop: Space.lg,
  },
  rings: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 22,
  },
  ghost: {
    width: SEAT,
    height: 38,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    borderWidth: 1.5,
    borderStyle: 'dashed',
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
