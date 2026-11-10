import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
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
import { Avatar } from '@/components/avatar';
import { Balloon } from '@/components/balloon';
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
import { BrandBalloon, Radius, Space } from '@/constants/theme';
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

/**
 * Home is one page that doesn't scroll: the wordmark, the play card filling the
 * screen with the brand balloon floating in it, your balloons, and, when a match
 * has written back, one row that says so.
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
  // The balloon is as big as the phone's height allows: about 220 pt on a 844 pt phone.
  const { height } = useWindowDimensions();
  const balloonSize = Math.round(Math.min(230, Math.max(120, (height - 480) * 0.6)));

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
        <Screen contentStyle={[styles.content, { paddingBottom: TAB_BAR_CLEARANCE }]}>
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

          <Rise index={1} style={styles.flex}>
            <View style={[styles.card, { backgroundColor: theme.field, borderColor: theme.border }]}>
              <View style={styles.liveRow}>
                {/* The green dot means live numbers; the city fallback goes without. */}
                {live ? <View style={[styles.liveDot, { backgroundColor: theme.success }]} /> : null}
                <ThemedText type="kicker">
                  {live
                    ? t('home.liveQueue', { count: live.waiting, city: profile.city })
                    : t('home.cardLabel', { city: profile.city })}
                </ThemedText>
              </View>
              <FloatingBalloon size={balloonSize} />
              <View style={styles.cardFoot}>
                <ThemedText
                  type="title"
                  accessibilityRole="header"
                  maxFontSizeMultiplier={1.2}
                  style={styles.cardTitle}>
                  {t('home.cardTitle')}
                </ThemedText>
                <Button
                  title={t('home.play')}
                  loading={joining}
                  onPress={join}
                  accessibilityHint={t('home.playHint')}
                />
              </View>
            </View>
          </Rise>

          <Rise index={2} style={styles.under}>
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
                background={theme.field}
                style={[styles.reply, { borderColor: theme.border }]}>
                <View>
                  <Avatar
                    name={reply.match.other.name}
                    uri={reply.match.other.photo}
                    tone={seatFor(seats, reply.match.other.id)}
                    size={40}
                  />
                  <View
                    style={[styles.replyDot, { backgroundColor: theme.brand, borderColor: theme.field }]}
                  />
                </View>
                <View style={styles.replyText}>
                  <ThemedText type="headline" numberOfLines={1}>
                    {t('home.textedBack', { name: reply.match.other.name })}
                  </ThemedText>
                  <ThemedText type="footnote" themeColor="textSecondary" numberOfLines={1}>
                    {previewLine(t, filter, reply, myId)}
                  </ThemedText>
                </View>
                <Icon name="chevronRight" size={13} color={theme.textTertiary} />
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
          </Rise>
        </Screen>
      </View>
    </TabSwipe>
  );
}

/**
 * The brand balloon in the play card, slowly floating up and down. Holds still
 * under Reduce Motion and while Home is off screen.
 */
function FloatingBalloon({ size }: { size: number }) {
  const reduced = useReduceMotion();
  const showing = useTabActive();
  const bob = useSharedValue(0);
  useEffect(() => {
    if (reduced || !showing) {
      cancelAnimation(bob);
      if (reduced) bob.set(0);
      return;
    }
    bob.set(withRepeat(withTiming(1, { duration: BOB_MS, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [reduced, showing, bob]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -10 * bob.get() }, { rotate: `${-2 + 4 * bob.get()}deg` }],
  }));
  return (
    <View
      style={styles.cardBalloon}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Animated.View style={style}>
        <Balloon color={BrandBalloon.color} size={size} />
      </Animated.View>
    </View>
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
  // The play card fills the page: the live line on top, the balloon floating in
  // the middle, the title and the button at its foot.
  card: {
    flex: 1,
    marginTop: Space.sm,
    padding: Space.md,
    paddingTop: 18,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    paddingHorizontal: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardBalloon: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Space.sm,
  },
  cardFoot: {
    gap: Space.md,
  },
  cardTitle: {
    paddingHorizontal: 6,
  },
  under: {
    gap: Space.sm,
    marginTop: Space.sm,
    alignItems: 'center',
  },
  reply: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingVertical: 10,
    paddingHorizontal: Space.md,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
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
