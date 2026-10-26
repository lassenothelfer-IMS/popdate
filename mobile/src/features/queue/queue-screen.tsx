import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  Keyframe,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated';

import { api, type Room } from '@/api';
import { Balloon, balloonHeight } from '@/components/balloon';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { CssEase, Ease, Fonts, Gutter, Motion, Space } from '@/constants/theme';
import { PopperSeat } from '@/features/queue/popper-seat';
import { useHardwareBack } from '@/hooks/use-hardware-back';
import { useQueueStatus, useRoom } from '@/hooks/use-server';
import { useT, type Translate } from '@/i18n';
import { seatAt, useSeats, useTheme } from '@/hooks/use-theme';
import { nativeOnly, webSafeKeyframe } from '@/utils/web-motion';
import { haptics } from '@/utils/haptics';
import { goHome } from '@/utils/navigation';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

/** One popper and five balloons. While searching, the server sends the real number. */
const ROOM_SIZE = 6;
/** How long the role beat holds before the room appears. A tap skips it. */
const ROLE_BEAT_MS = 1500;
/** With a screen reader on, the beat holds long enough for the role line to be read out. */
const ROLE_BEAT_SCREEN_READER_MS = 4000;
/**
 * If the room never answers (a slow or failed watch), the room opens anyway after this.
 * The room screen has its own loading and missing states.
 */
const ROOM_WAIT_MS = ROLE_BEAT_MS * 2;
/** A balloon seat, string off: 20 x 28. */
const SEAT_SIZE = 20;
/** Your own balloon during the role beat, drawn larger instead of dimming the others. */
const MY_SEAT_SIZE = 26;

/** A seat lands when someone takes it. Never from scale 0. */
const seatLands = webSafeKeyframe(
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 8 }, { scale: 0.92 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Ease.out },
  }).duration(Motion.enter),
);

/** Reduce Motion: the seat only fades in. */
const seatFades = webSafeKeyframe(
  new Keyframe({
    0: { opacity: 0 },
    100: { opacity: 1, easing: Ease.out },
  })
    .duration(Motion.state)
    .reduceMotion(ReduceMotion.Never),
);

/** The role lines replace the queue lines. Opacity only, so it stays under Reduce Motion. */
const beatIn = FadeIn.duration(Motion.state).easing(Ease.out).reduceMotion(ReduceMotion.Never);

/**
 * The lines can change height (a longer line, or a title that wraps at large
 * text sizes) and the row grows when your balloon does; the rest moves smoothly
 * instead of jumping. Native only: on web it would squash the views that resize.
 */
const reflow = nativeOnly(LinearTransition.duration(Motion.enter).easing(Ease.inOut));

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
  return value >= 0 && value <= 10 ? t(`queue.number${value}`) : String(value);
}

function capitalized(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
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
  title: string;
  line: string;
  /** Your balloon seat, or null when you are the popper. */
  mySeat: number | null;
  popper: { name: string; photo: string | null };
};

function roleBeat(room: Room, t: Translate): RoleBeat {
  const popper = { name: room.popper.name, photo: room.popper.photos[0] ?? null };
  const count = room.totalRounds;
  const rounds = numberWord(t, count);
  if (room.me.role === 'popper') {
    return {
      title: t('queue.popperTitle'),
      line: t('queue.popperLine', {
        count,
        rounds,
        people: capitalized(numberWord(t, room.contestants.length)),
      }),
      mySeat: null,
      popper,
    };
  }
  const mySeat = room.contestants.findIndex((contestant) => contestant.id === room.me.id);
  return {
    title: t('queue.contestantTitle'),
    line: t('queue.contestantLine', { count, rounds, name: room.popper.name }),
    mySeat: mySeat >= 0 ? mySeat : null,
    popper,
  };
}

export function QueueScreen() {
  const status = useQueueStatus();

  if (status.state === 'idle') return <NotInQueue />;

  // The same element in both states, so the seats that already landed stay put.
  return (
    <FillingRoom
      found={status.state === 'searching' ? status.found : ROOM_SIZE}
      needed={status.state === 'searching' ? status.needed : ROOM_SIZE}
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
      <Animated.View entering={idleIn} style={styles.stage}>
        <ThemedText themeColor="textSecondary" style={styles.centered}>
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

  const matched = roomId !== null;
  const beat = matched && room ? roleBeat(room, t) : null;
  const seatsFilled = t('queue.seatsFilled', { found, needed });
  const beatText = beat ? `${beat.title}. ${beat.line}` : null;
  const ready = matched && room !== undefined;
  const missing = room === null;

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
      AccessibilityInfo.announceForAccessibility(seatsFilled);
    }
  }, [matched, found, seatsFilled]);

  // The role lines mount fresh, with no live region, so both platforms get them announced.
  useEffect(() => {
    if (beatText) AccessibilityInfo.announceForAccessibility(beatText);
  }, [beatText]);

  async function handleCancel() {
    // Once the room is full you are in it; the button is already fading out.
    if (matched) return;
    await api.leaveQueue();
    goHome();
  }

  function skipBeat() {
    if (!roomId || entered.current) return;
    entered.current = true;
    openRoom(roomId);
  }

  // Android's back button cancels like the button, so the queue doesn't fill a room
  // you've left. Once you're matched it does nothing: the room is on its way.
  useHardwareBack(() => void handleCancel());

  return (
    <Screen
      scroll
      // Plain, so nothing of the footer is left once Cancel fades out for the role beat.
      footerStyle="plain"
      contentStyle={styles.content}
      footer={
        <Animated.View
          accessibilityElementsHidden={matched}
          importantForAccessibility={matched ? 'no-hide-descendants' : 'auto'}
          style={{
            opacity: matched ? 0 : 1,
            pointerEvents: matched ? 'none' : 'auto',
            transitionProperty: 'opacity',
            transitionDuration: Motion.exit,
            transitionTimingFunction: CssEase.out,
          }}>
          <Button title={t('common.cancel')} variant="secondary" onPress={handleCancel} />
        </Animated.View>
      }>
      {roomId ? <RoomWatcher roomId={roomId} onChange={setRoom} /> : null}

      {/* Once the room is full a tap anywhere opens it right away, even before it answers. */}
      <Pressable accessible={false} disabled={!roomId} onPress={skipBeat} style={styles.stage}>
        <Animated.View
          key={beat ? 'role-title' : 'queue-title'}
          entering={beat ? beatIn : undefined}
          layout={reflow}>
          <ThemedText type="question" accessibilityRole="header" style={styles.centered}>
            {beat ? beat.title : t('queue.filling')}
          </ThemedText>
        </Animated.View>

        <Animated.View layout={reflow} style={styles.countGroup}>
          <ThemedText
            type="count"
            accessible
            accessibilityLabel={seatsFilled}
            accessibilityLiveRegion="polite"
            maxFontSizeMultiplier={1.3}
            style={styles.centered}>
            {found}
            <Text style={[styles.countRest, { color: theme.textSecondary }]}>
              {t('queue.countRest', { needed })}
            </Text>
          </ThemedText>
        </Animated.View>

        <Animated.View layout={reflow} style={styles.seatsGroup}>
          <Seats found={found} needed={needed} mySeat={beat?.mySeat ?? null} popper={beat?.popper ?? null} />
        </Animated.View>

        <Animated.View
          key={beat ? 'role-line' : 'queue-line'}
          entering={beat ? beatIn : undefined}
          layout={reflow}
          style={styles.copy}>
          <ThemedText type="callout" themeColor="textSecondary" style={styles.centered}>
            {beat
              ? beat.line
              : t('queue.perRoom', { people: capitalized(numberWord(t, needed)) })}
          </ThemedText>
        </Animated.View>
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

type SeatsProps = {
  found: number;
  needed: number;
  /** Your balloon during the role beat: it grows, the others stay as they are. */
  mySeat: number | null;
  /** Once the room is known: the person in the popper's seat. */
  popper: { name: string; photo: string | null } | null;
};

/**
 * Five balloon seats in seat order, then the popper's seat. They fill left to
 * right as people arrive, so the popper's seat is the one that completes the room.
 */
function Seats({ found, needed, mySeat, popper }: SeatsProps) {
  const seats = useSeats();
  const reduced = useReduceMotion();
  const entering = reduced ? seatFades : seatLands;
  const balloonSeats = Math.max(needed - 1, 0);
  const popperFilled = found >= needed;

  return (
    <View
      style={styles.seats}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {Array.from({ length: balloonSeats }, (_, index) => {
        const filled = index < found;
        return (
          <Animated.View
            key={`${index}-${filled ? 'filled' : 'empty'}`}
            entering={filled ? entering : undefined}>
            <SeatBalloon
              color={seatAt(seats, index).color}
              filled={filled}
              grown={mySeat === index}
              reduced={reduced}
            />
          </Animated.View>
        );
      })}
      <Animated.View
        key={popperFilled ? 'popper-filled' : 'popper-empty'}
        entering={popperFilled ? entering : undefined}>
        <PopperSeat filled={popperFilled} name={popper?.name ?? null} photoUri={popper?.photo ?? null} />
      </Animated.View>
    </View>
  );
}

type SeatBalloonProps = {
  color: string;
  filled: boolean;
  /** Your seat during the role beat: 26 x 36 instead of 20 x 28. */
  grown: boolean;
  reduced: boolean;
};

/**
 * One balloon seat. A filled one is drawn at your seat's size and scaled down,
 * so growing into your seat is one transition on the box and the scale together,
 * anchored at the bottom like the row. Reduce Motion: it just changes size.
 */
function SeatBalloon({ color, filled, grown, reduced }: SeatBalloonProps) {
  // Never grown: every seat has filled before the role beat. Drawn at its own size, so the outline stays 1.5pt.
  if (!filled) return <Balloon color={color} size={SEAT_SIZE} ghost />;

  const size = grown ? MY_SEAT_SIZE : SEAT_SIZE;
  const timing = {
    transitionDuration: reduced ? 0 : Motion.enter,
    transitionTimingFunction: CssEase.out,
  };
  return (
    <Animated.View
      style={[
        styles.seatBox,
        { width: size, height: balloonHeight(size), transitionProperty: ['width', 'height'], ...timing },
      ]}>
      <Animated.View
        style={[
          styles.seatArt,
          { transform: [{ scale: size / MY_SEAT_SIZE }], transitionProperty: 'transform', ...timing },
        ]}>
        <Balloon color={color} size={MY_SEAT_SIZE} string={false} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  // With the screen's gutter, the column sits 40 in from each edge.
  stage: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Gutter,
    paddingVertical: Space.lg,
  },
  centered: {
    textAlign: 'center',
  },
  // 14 on the canvas, less the 2pt the count's 68pt line adds above a 64pt line.
  countGroup: {
    marginTop: 12,
  },
  countRest: {
    fontFamily: Fonts.serif,
  },
  // 32 on the canvas, less the 2pt the count's line adds below.
  seatsGroup: {
    marginTop: 30,
  },
  seats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'center',
    rowGap: Space.sm,
    columnGap: Space.md,
  },
  seatBox: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  seatArt: {
    transformOrigin: 'bottom',
  },
  copy: {
    marginTop: 28,
    maxWidth: 260,
  },
});
