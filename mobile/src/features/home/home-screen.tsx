import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import {
  api,
  getMockNextRole,
  isMockServer,
  setMockNextRole,
  type MockRole,
  type QueueStats,
} from '@/api';
import { TabSwipe } from '@/components/tab-swipe';
import { Backdrop } from '@/components/backdrop';
import { Imagery } from '@/constants/imagery';
import { QueueFaces } from '@/features/home/queue-faces';
import { Avatar } from '@/components/avatar';
import { Balloon, balloonHeight } from '@/components/balloon';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { ErrorLine } from '@/components/error-line';
import { Icon } from '@/components/icon';
import { PressableHighlight } from '@/components/pressable-highlight';
import { Rise } from '@/components/rise';
import { Screen } from '@/components/screen';
import { TAB_BAR_CLEARANCE, useTabActive, useTabFocus } from '@/components/tab-bar';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { BrandBalloon, Fonts, Space } from '@/constants/theme';
import { roomStats, useRoomHistory } from '@/features/rooms/use-room-history';
import { BalloonLine } from '@/features/balloons/balloon-line';
import { useJoinQueue } from '@/features/home/use-join-queue';
import { previewLine, withLastMessages, type Thread } from '@/features/matches/threads';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { seatFor, useSeats, useTheme } from '@/hooks/use-theme';
import { useT, type TranslationKey } from '@/i18n';
import { useSession } from '@/state/session';
import { useFilterText } from '@/state/settings';

/** The test server's role chips, labeled by their `home.*` keys. */
const MOCK_ROLES: { role: MockRole; label: TranslationKey }[] = [
  { role: 'random', label: 'home.roleRandom' },
  { role: 'popper', label: 'home.rolePopper' },
  { role: 'contestant', label: 'home.roleBalloon' },
];

/** How often the live queue line refreshes while Home is on screen. */
const LIVE_REFRESH_MS = 20_000;
/** After this many rooms you know the game: How to play leaves Home and stays in Settings. */
const HOW_TO_PLAY_ROOMS = 5;
/** One float up and back down of the balloon. */
const BOB_MS = 2800;
/** The balloon's flight off the top of the screen, once you are in the line. */
const FLIGHT_MS = 620;

/**
 * Play is one page that doesn't scroll, and mostly air: the headline, then the
 * brand balloon, which is the button. "Get in line" hangs on its string. Press
 * it and it gives a little; once you are in the line it flies up and out while
 * the page falls away, and the line opens with the same balloon rising into it.
 */
export function HomeScreen() {
  const { profile } = useSession();
  const seats = useSeats();
  const theme = useTheme();
  const t = useT();
  const filter = useFilterText();
  const myId = profile?.id ?? null;
  /** The newest chat where they wrote last. Null while there is none. */
  const [reply, setReply] = useState<Thread | null>(null);
  const [mockRole, setMockRole] = useState(getMockNextRole);
  const { join, joining, error, balloons } = useJoinQueue();
  /** Null until it loads, or while it can't: the line then falls back to the city. */
  const [live, setLive] = useState<QueueStats | null>(null);
  const { history, failed: historyFailed } = useRoomHistory();
  const stats = history ? roomStats(history) : null;
  // Waits for your rooms, so it doesn't flash and go for someone who has played
  // plenty. If they can't load, it shows.
  const showHowToPlay = stats ? stats.played < HOW_TO_PLAY_ROOMS : historyFailed;
  // The balloon is as big as the phone's height allows: about 170 pt wide on a 844 pt phone.
  const { height } = useWindowDimensions();
  const balloonSize = Math.round(Math.min(184, Math.max(110, (height - 500) * 0.5)));
  const reduced = useReduceMotion();
  /** 0 at rest, 1 once the balloon has flown off and the page has fallen away. */
  const flight = useSharedValue(0);

  // Back on Play, everything is where it was.
  useTabFocus(
    useCallback(() => {
      flight.set(0);
    }, [flight]),
  );

  /** Played between joining the line and opening it. */
  function takeOff() {
    if (reduced) return Promise.resolve();
    flight.set(withTiming(1, { duration: FLIGHT_MS, easing: Easing.bezier(0.5, 0, 0.8, 0.5) }));
    // The line opens just before the balloon is gone, so the two overlap.
    return new Promise<void>((resolve) => setTimeout(resolve, FLIGHT_MS - 140));
  }
  const falling = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, flight.get() * 2.2),
    transform: [{ translateY: 26 * flight.get() }],
  }));

  const loadLive = useCallback(
    (isCurrent: () => boolean = () => true) =>
      api.getQueueStats().then(
        (queue) => {
          if (isCurrent()) setLive(queue);
        },
        () => {},
      ),
    [],
  );

  const loadReply = useCallback(
    (isCurrent: () => boolean = () => true) =>
      api
        .listMatches()
        .then((list) => withLastMessages(list))
        .then(
          (threads) => {
            if (!isCurrent()) return;
            const waiting = threads
              .filter(({ last }) => last && last.senderId !== myId)
              .sort((a, b) => (b.last?.sentAt ?? '').localeCompare(a.last?.sentAt ?? ''));
            setReply(waiting[0] ?? null);
          },
          () => {},
        ),
    [myId],
  );

  // Who's queuing and who wrote back: fetched on every visit, then every 20 s while Home is on screen.
  useTabFocus(
    useCallback(() => {
      let active = true;
      const isCurrent = () => active;
      const load = () => {
        void loadLive(isCurrent);
        void loadReply(isCurrent);
      };
      load();
      const timer = setInterval(load, LIVE_REFRESH_MS);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [loadLive, loadReply]),
  );

  if (!profile) return <Redirect href="/" />;

  function chooseMockRole(role: MockRole) {
    setMockNextRole(role);
    setMockRole(role);
  }

  return (
    <TabSwipe tab="home">
      <View style={styles.flex}>
        <Screen
          background={<Backdrop slot={Imagery.play} />}
          contentStyle={[styles.content, { paddingBottom: TAB_BAR_CLEARANCE }]}>
          <Animated.View style={[styles.flex, falling]}>
            <Rise index={0} style={styles.top}>
              <Wordmark />
              {/* Only for your first few rooms; after that it lives in Settings. */}
              {showHowToPlay ? (
                <Button
                  title={t('home.howToPlay')}
                  variant="plain"
                  fullWidth={false}
                  onPress={() => router.push('/how-to-play')}
                />
              ) : null}
            </Rise>

            <Rise index={1} style={styles.head}>
              <ThemedText type="hero" accessibilityRole="header" maxFontSizeMultiplier={1.2}>
                {t('home.cardTitle')}
              </ThemedText>
              {live ? <QueueFaces faces={live.faces} /> : null}
              <ThemedText type="body">
                {/* A city is optional now: without one, the line just says how many are waiting. */}
                {profile.city
                  ? live
                    ? t('home.liveQueue', { count: live.waiting, city: profile.city })
                    : t('home.cardLabel', { city: profile.city })
                  : live
                    ? t('home.liveQueueAnywhere', { count: live.waiting })
                    : t('home.cardLabelAnywhere')}
              </ThemedText>
            </Rise>
          </Animated.View>

          <Rise index={2} style={styles.stage}>
            <PlayBalloon
              size={balloonSize}
              label={t('home.play')}
              hint={t('home.playHint')}
              busy={joining}
              empty={balloons.count === 0}
              flight={flight}
              height={height}
              onPress={() => void join(takeOff)}
            />
          </Rise>

          <Animated.View style={[styles.under, falling]}>
            {error ? <ErrorLine message={error} /> : null}
            <BalloonLine balloons={balloons} />
            {reply ? (
              <PressableHighlight
                accessibilityRole="button"
                accessibilityLabel={t('home.textedBack', { name: reply.match.other.name })}
                accessibilityHint={t('home.openChatHint')}
                onPress={() =>
                  router.push({ pathname: '/chat/[id]', params: { id: reply.match.id } })
                }
                background={theme.page}
                style={[styles.reply, { borderTopColor: theme.border }]}>
                <View>
                  <Avatar
                    name={reply.match.other.name}
                    uri={reply.match.other.photo}
                    tone={seatFor(seats, reply.match.other.id)}
                    size={40}
                  />
                  <View
                    style={[styles.replyDot, { backgroundColor: theme.brand, borderColor: theme.page }]}
                  />
                </View>
                <View style={styles.replyText}>
                  <ThemedText type="headline" numberOfLines={1}>
                    {t('home.textedBack', { name: reply.match.other.name })}
                  </ThemedText>
                  <ThemedText type="callout" themeColor="textSecondary" numberOfLines={1}>
                    {previewLine(t, filter, reply, myId)}
                  </ThemedText>
                </View>
                <Icon name="chevronRight" size={13} color={theme.textSecondary} />
              </PressableHighlight>
            ) : null}
            {/* Only in development: a store build never shows the bots' test controls. */}
            {isMockServer && __DEV__ ? (
              <View
                style={styles.chips}
                accessibilityRole="radiogroup"
                accessibilityLabel={t('home.roleGroup')}>
                {MOCK_ROLES.map(({ role, label }) => (
                  <Chip
                    key={role}
                    label={t(label)}
                    selected={mockRole === role}
                    onPress={() => chooseMockRole(role)}
                  />
                ))}
              </View>
            ) : null}
          </Animated.View>
        </Screen>
      </View>
    </TabSwipe>
  );
}

type PlayBalloonProps = {
  size: number;
  label: string;
  hint: string;
  /** Joining the line: no second press, and the tag shows it is working. */
  busy: boolean;
  /** No balloons left: drawn in dashes. The press then opens the balloon shop. */
  empty: boolean;
  flight: SharedValue<number>;
  /** The window's height: how far up the flight goes. */
  height: number;
  onPress: () => void;
};

/**
 * The brand balloon, and the way into a room: it floats, gives under your
 * finger, and carries its label as a tag on its string. Holds still under
 * Reduce Motion and while Play is off screen.
 */
function PlayBalloon({ size, label, hint, busy, empty, flight, height, onPress }: PlayBalloonProps) {
  const theme = useTheme();
  const reduced = useReduceMotion();
  const showing = useTabActive();
  const bob = useSharedValue(0);
  const press = useSharedValue(0);
  useEffect(() => {
    if (reduced || !showing) {
      cancelAnimation(bob);
      if (reduced) bob.set(0);
      return;
    }
    bob.set(withRepeat(withTiming(1, { duration: BOB_MS, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [reduced, showing, bob]);
  const style = useAnimatedStyle(() => {
    const up = flight.get();
    const squash = press.get();
    return {
      transform: [
        { translateY: -10 * bob.get() * (1 - up) + 8 * squash - (height * 0.9 + size) * up },
        { rotate: `${(-2 + 4 * bob.get()) * (1 - up) + 4 * up}deg` },
        { scaleX: 1 + 0.05 * squash - 0.08 * up },
        { scaleY: 1 - 0.07 * squash + 0.1 * up },
      ],
    };
  });
  // The tag lets go of the string as the balloon leaves.
  const tag = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, flight.get() * 4) }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPressIn={() => press.set(withTiming(1, { duration: 120 }))}
      onPressOut={() => press.set(withSequence(withTiming(-0.4, { duration: 140 }), withTiming(0, { duration: 220 })))}
      onPress={onPress}
      style={styles.play}>
      <Animated.View style={[styles.playBalloon, style]}>
        <Balloon color={BrandBalloon.color} size={size} ghost={empty} ghostInk={theme.brand} />
        <Animated.View
          style={[styles.tag, { backgroundColor: theme.inverse, top: balloonHeight(size) - 22 }, tag]}>
          {busy ? <ActivityIndicator size="small" color={theme.onInverse} /> : null}
          <Text style={[styles.tagText, { color: theme.onInverse }]}>{label}</Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingTop: Space.xs,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  head: {
    marginTop: Space.lg,
    gap: Space.sm,
  },
  // The balloon has the rest of the page to itself.
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 30,
  },
  playBalloon: {
    alignItems: 'center',
  },
  // "Get in line", tied to the end of the string.
  tag: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderCurve: 'continuous',
    boxShadow: '0 6px 16px rgba(25, 25, 25, 0.18)',
  },
  tagText: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: 600,
  },
  under: {
    gap: Space.sm,
    alignItems: 'center',
  },
  // Someone wrote back: one row over a hairline, no box.
  reply: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
  },
  replyText: {
    flex: 1,
    gap: 1,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Space.xs,
  },
});
