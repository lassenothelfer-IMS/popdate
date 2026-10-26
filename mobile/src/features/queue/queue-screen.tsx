import { router } from 'expo-router';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  Keyframe,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { api, type Room } from '@/api';
import { Balloon, balloonHeight } from '@/components/balloon';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { CssEase, Ease, Motion, Space } from '@/constants/theme';
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
/** Velvet hour's float-in curve: a slow rise that settles softly. */
const FloatIn = Easing.bezier(0.16, 0.84, 0.24, 1);
/** How long the role beat holds before the room appears. A tap skips it. */
const ROLE_BEAT_MS = 1500;
/** With a screen reader on, the beat holds long enough for the role line to be read out. */
const ROLE_BEAT_SCREEN_READER_MS = 4000;
/**
 * If the room never answers (a slow or failed watch), the room opens anyway after this.
 * The room screen has its own loading and missing states.
 */
const ROOM_WAIT_MS = ROLE_BEAT_MS * 2;
/**
 * The balloon cluster, in seat order: each balloon's width and how high it floats
 * above the lowest one. Different sizes and heights, so the room reads as people,
 * not a progress bar. Past five seats the pattern repeats.
 */
const CLUSTER = [
  { size: 64, lift: 36 },
  { size: 78, lift: 92 },
  { size: 70, lift: 18 },
  { size: 74, lift: 104 },
  { size: 66, lift: 54 },
] as const;
/** Your own balloon during the role beat grows by this much instead of dimming the others. */
const GROWN = 1.3;
/** The gold string under each balloon, long enough to run toward the count. */
const STRING_LENGTH = 120;
/** Each balloon sways on its own loop, so the room breathes out of phase. */
const SWAY_MS = [5600, 4800, 6600, 5200, 6100] as const;

/** A balloon floats up into its place when someone takes the seat. Never from scale 0. */
const seatLands = webSafeKeyframe(
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 160 }, { scale: 0.96 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: FloatIn },
  }).duration(1400),
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
          {/* The seats filled so far, as one gold line on the empty track. */}
          <View style={[styles.track, { backgroundColor: theme.track }]}>
            <Animated.View
              style={[
                styles.trackFill,
                {
                  backgroundColor: theme.gold,
                  width: `${needed > 0 ? Math.min(found / needed, 1) * 100 : 0}%`,
                  transitionProperty: 'width',
                  transitionDuration: Motion.enter,
                  transitionTimingFunction: CssEase.out,
                },
              ]}
            />
          </View>
          <View style={styles.footerRow}>
            <Button title={t('common.cancel')} variant="ghost" onPress={handleCancel} />
          </View>
        </Animated.View>
      }>
      {roomId ? <RoomWatcher roomId={roomId} onChange={setRoom} /> : null}

      <Wordmark />

      {/* Once the room is full a tap anywhere opens it right away, even before it answers. */}
      <Pressable accessible={false} disabled={!roomId} onPress={skipBeat} style={styles.stage}>
        <Animated.View
          key={beat ? 'role-title' : 'queue-title'}
          entering={beat ? beatIn : undefined}
          layout={reflow}>
          <ThemedText type="hero" accessibilityRole="header" maxFontSizeMultiplier={1.3}>
            {beat ? beat.title : t('queue.filling')}
          </ThemedText>
        </Animated.View>

        <Animated.View layout={reflow} style={styles.seatsGroup}>
          <Seats found={found} needed={needed} mySeat={beat?.mySeat ?? null} popper={beat?.popper ?? null} />
        </Animated.View>

        <Animated.View layout={reflow} style={styles.countGroup}>
          <View
            style={styles.countRow}
            accessible
            accessibilityLabel={seatsFilled}
            accessibilityLiveRegion="polite">
            <ThemedText type="count" maxFontSizeMultiplier={1} allowFontScaling={false}>
              {found}
            </ThemedText>
            <View style={styles.countSide}>
              <ThemedText type="body" style={styles.countRest} maxFontSizeMultiplier={1.4}>
                {t('queue.countRest', { needed }).trim()}
              </ThemedText>
              <Animated.View
                key={beat ? 'role-line' : 'queue-line'}
                entering={beat ? beatIn : undefined}>
                <ThemedText
                  type="footnote"
                  themeColor={beat ? 'gold' : 'textTertiary'}
                  maxFontSizeMultiplier={1.4}>
                  {beat
                    ? beat.line
                    : t('queue.perRoom', { people: capitalized(numberWord(t, needed)) })}
                </ThemedText>
              </Animated.View>
            </View>
          </View>
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
        const spot = CLUSTER[index % CLUSTER.length];
        return (
          <Animated.View
            key={`${index}-${filled ? 'filled' : 'empty'}`}
            entering={filled ? entering : undefined}
            style={{ marginBottom: spot.lift, marginHorizontal: -Space.xxs }}>
            <Sway duration={SWAY_MS[index % SWAY_MS.length]} delay={index * 380} still={!filled}>
              <SeatBalloon
                color={seatAt(seats, index).color}
                size={spot.size}
                filled={filled}
                grown={mySeat === index}
                reduced={reduced}
              />
            </Sway>
          </Animated.View>
        );
      })}
      <Animated.View
        key={popperFilled ? 'popper-filled' : 'popper-empty'}
        entering={popperFilled ? entering : undefined}
        style={styles.popperSpot}>
        <PopperSeat filled={popperFilled} name={popper?.name ?? null} photoUri={popper?.photo ?? null} />
      </Animated.View>
    </View>
  );
}

/**
 * Sways its balloon forever around the foot of the string: a slow tilt and a
 * small bob, each balloon on its own loop. Still under Reduce Motion, and for
 * an empty seat.
 */
function Sway({
  duration,
  delay,
  still,
  children,
}: {
  duration: number;
  delay: number;
  still: boolean;
  children: ReactNode;
}) {
  const reduced = useReduceMotion();
  const swing = useSharedValue(0.5);
  useEffect(() => {
    if (reduced || still) {
      cancelAnimation(swing);
      swing.set(0.5);
      return;
    }
    swing.set(
      withDelay(
        delay,
        withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }), -1, true),
      ),
    );
  }, [reduced, still, duration, delay, swing]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -8 * swing.get() },
      { rotate: `${-1.4 + 2.8 * swing.get()}deg` },
    ],
  }));
  return <Animated.View style={[styles.sway, style]}>{children}</Animated.View>;
}

type SeatBalloonProps = {
  color: string;
  /** The balloon's width in the cluster. */
  size: number;
  filled: boolean;
  /** Your seat during the role beat: it grows instead of the others dimming. */
  grown: boolean;
  reduced: boolean;
};

/**
 * One balloon seat with its long gold string. A filled one is drawn at its grown
 * size and scaled down, so growing into your seat is one transition on the box
 * and the scale together, anchored at the foot. Reduce Motion: it just changes size.
 */
function SeatBalloon({ color, size: base, filled, grown, reduced }: SeatBalloonProps) {
  const theme = useTheme();
  // Never grown: every seat has filled before the role beat. Drawn at its own size, so the outline stays 1.5pt.
  if (!filled) {
    return (
      <View style={styles.seatBox}>
        <Balloon color={color} size={base} ghost />
        <View style={{ height: STRING_LENGTH }} />
      </View>
    );
  }

  const largest = base * GROWN;
  const size = grown ? largest : base;
  const timing = {
    transitionDuration: reduced ? 0 : Motion.enter,
    transitionTimingFunction: CssEase.out,
  };
  return (
    <View style={styles.seatBox}>
      <Animated.View
        style={[
          styles.seatBox,
          { width: size, height: balloonHeight(size), transitionProperty: ['width', 'height'], ...timing },
        ]}>
        <Animated.View
          style={[
            styles.seatArt,
            { transform: [{ scale: size / largest }], transitionProperty: 'transform', ...timing },
          ]}>
          <Balloon color={color} size={largest} string={false} />
        </Animated.View>
      </Animated.View>
      <LongString color={theme.gold} />
    </View>
  );
}

/** A gold string hanging from the knot, fading out toward the bottom. */
function LongString({ color }: { color: string }) {
  const id = `string${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={12} height={STRING_LENGTH} style={styles.string}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.75} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path
        d={`M6 0c-4 ${STRING_LENGTH * 0.25} 4 ${STRING_LENGTH * 0.5} 0 ${STRING_LENGTH * 0.75}s-2 ${STRING_LENGTH * 0.2} 0 ${STRING_LENGTH * 0.25}`}
        stroke={`url(#${id})`}
        strokeWidth={1.2}
        fill="none"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  centered: {
    textAlign: 'center',
  },
  // The headline up top, the balloons in the middle, the count at the foot.
  stage: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingTop: Space.xl,
  },
  seatsGroup: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    marginTop: Space.lg,
    // The strings run on behind the count.
    marginBottom: -Space.xxl,
  },
  // A loose cluster: balloons overlap a little, each at its own height.
  seats: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  sway: {
    transformOrigin: 'bottom',
  },
  seatBox: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  seatArt: {
    transformOrigin: 'bottom',
  },
  string: {
    marginTop: -2,
  },
  popperSpot: {
    marginBottom: STRING_LENGTH * 0.6,
    marginLeft: Space.xs,
  },
  countGroup: {
    marginTop: Space.lg,
  },
  // The big number with "of 6" and the line beside it, sitting on its baseline.
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  countSide: {
    flex: 1,
    gap: Space.xxs,
  },
  countRest: {
    fontWeight: 500,
  },
  track: {
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
    marginBottom: Space.xs,
  },
  trackFill: {
    height: 2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
