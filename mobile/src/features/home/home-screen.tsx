import { Redirect, router, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  api,
  getMockNextRole,
  isMockServer,
  setMockNextRole,
  type MockRole,
  type Profile,
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
import { TAB_BAR_CLEARANCE, useTabFocus } from '@/components/tab-bar';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { BrandBalloon, Radius, Space } from '@/constants/theme';
import { outcomeLine } from '@/features/rooms/rooms-screen';
import { roomStats, useRoomHistory } from '@/features/rooms/use-room-history';
import { BalloonLine } from '@/features/balloons/balloon-line';
import { useJoinQueue } from '@/features/home/use-join-queue';
import { previewLine, withLastMessages, type Thread } from '@/features/matches/threads';
import { seatFor, useSeats, useTheme } from '@/hooks/use-theme';
import { useLocale, useT, type Translate, type TranslationKey } from '@/i18n';
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
/** Home shows your newest matches; the Matches tab has them all. */
const HOME_MATCHES = 2;
/** After this many rooms you know the game: How to play leaves Home and stays in Settings. */
const HOW_TO_PLAY_ROOMS = 5;

type DayPart = 'Morning' | 'Afternoon' | 'Evening' | 'Night';

function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 18) return 'Afternoon';
  if (hour >= 18 && hour < 22) return 'Evening';
  return 'Night';
}

/** "Good evening, Lasse." and "Zürich, Monday night", for right now. */
function greeting(t: Translate, locale: string, name: string, city: string) {
  const now = new Date();
  const part = dayPart(now.getHours());
  let weekday = '';
  try {
    weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(now);
  } catch {
    weekday = '';
  }
  // Night still says good evening, as people do.
  const hello = part === 'Night' ? 'Evening' : part;
  return {
    hero: t(`home.greet${hello}`, { name }),
    live: t('home.liveLine', { city, day: t(`home.part${part}`, { weekday }) }),
  };
}

/**
 * What Complete your profile asks for: only the optional parts still missing,
 * like "Add your job". Null once height, job and bio are all in.
 */
function missingNote(t: Translate, profile: Pick<Profile, 'heightCm' | 'job' | 'bio'>) {
  const items = [
    profile.heightCm === null ? t('home.completeHeight') : null,
    profile.job.trim() ? null : t('home.completeJob'),
    profile.bio.trim() ? null : t('home.completeBio'),
  ].filter((item): item is string => item !== null);
  if (items.length === 0) return null;
  const [a, b, c] = items;
  const list =
    items.length === 1
      ? a
      : items.length === 2
        ? t('home.completeTwo', { a, b })
        : t('home.completeThree', { a, b, c });
  return t('home.completeProfileNote', { items: list });
}

export function HomeScreen() {
  const { profile } = useSession();
  const seats = useSeats();
  const theme = useTheme();
  const t = useT();
  const locale = useLocale();
  const filter = useFilterText();
  /** Your newest matches with their last message. Null until the first load, so nothing flashes before the rows. */
  const [matches, setMatches] = useState<Thread[] | null>(null);
  const [mockRole, setMockRole] = useState(getMockNextRole);
  const { join, joining, error, balloons } = useJoinQueue();
  /** Null until it loads, or while it can't: the line then falls back to the day and city. */
  const [live, setLive] = useState<QueueStats | null>(null);
  const { history, failed: historyFailed, reload: reloadHistory } = useRoomHistory();
  const lastRoom = history?.[0];
  const stats = history ? roomStats(history) : null;
  const streak = stats?.streak ?? 0;
  // Waits for your rooms, so it doesn't flash and go for someone who has played
  // plenty. If they can't load, it shows.
  const showHowToPlay = stats ? stats.played < HOW_TO_PLAY_ROOMS : historyFailed;

  const loadLive = useCallback(
    (isCurrent: () => boolean = () => true) =>
      api.getQueueStats().then(
        (stats) => {
          if (isCurrent()) setLive(stats);
        },
        () => {},
      ),
    [],
  );

  const loadMatches = useCallback(
    (isCurrent: () => boolean = () => true) =>
      api
        .listMatches()
        .then((list) =>
          withLastMessages(
            [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, HOME_MATCHES),
          ),
        )
        .then(
          (list) => {
            if (isCurrent()) setMatches(list);
          },
          () => {
            if (isCurrent()) setMatches((previous) => previous ?? []);
          },
        ),
    [],
  );

  // Who's queuing right now: fetched on every visit, then every 20 s while Home is on screen.
  useTabFocus(
    useCallback(() => {
      let active = true;
      const isCurrent = () => active;
      void loadLive(isCurrent);
      const timer = setInterval(() => void loadLive(isCurrent), LIVE_REFRESH_MS);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [loadLive]),
  );

  useTabFocus(
    useCallback(() => {
      let active = true;
      void loadMatches(() => active);
      return () => {
        active = false;
      };
    }, [loadMatches]),
  );

  function refresh() {
    return Promise.all([loadLive(), loadMatches(), reloadHistory()]);
  }

  if (!profile) return <Redirect href="/" />;

  function chooseMockRole(role: MockRole) {
    setMockNextRole(role);
    setMockRole(role);
  }

  const words = greeting(t, locale, profile.name, profile.city);
  const missing = missingNote(t, profile);

  return (
    <TabSwipe tab="home">
    <View style={styles.flex}>
      <Screen
        scroll
        onRefresh={refresh}
        contentStyle={[styles.content, { paddingBottom: TAB_BAR_CLEARANCE }]}>
        <Rise index={0} style={styles.top}>
          <Wordmark />
        </Rise>

        <Rise index={1} style={styles.hello}>
          <View style={styles.liveRow}>
            {/* The green dot means live numbers; the day-and-city fallback goes without. */}
            {live ? <View style={[styles.liveDot, { backgroundColor: theme.success }]} /> : null}
            <ThemedText type="kicker">
              {live
                ? t('home.liveQueue', { count: live.waiting, city: profile.city })
                : words.live}
            </ThemedText>
          </View>
          <ThemedText type="hero" accessibilityRole="header" maxFontSizeMultiplier={1.3}>
            {words.hero}
          </ThemedText>
        </Rise>

        <Rise index={2}>
          <View style={[styles.card, { backgroundColor: theme.field, borderColor: theme.border }]}>
            <View
              style={styles.cardBalloon}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants">
              <Balloon color={BrandBalloon.color} size={260} />
            </View>
            <View style={styles.cardText}>
              <ThemedText type="kicker">{t('home.cardLabel', { city: profile.city })}</ThemedText>
              <ThemedText type="display" style={styles.cardTitle} maxFontSizeMultiplier={1.3}>
                {t('home.cardTitle')}
              </ThemedText>
            </View>
            <Button
              title={t('home.play')}
              loading={joining}
              onPress={join}
              accessibilityHint={t('home.playHint')}
            />
          </View>
          {error ? <ErrorLine message={error} /> : null}
          <View style={styles.balloonLine}>
            <BalloonLine balloons={balloons} />
          </View>
        </Rise>

        <Rise index={3} style={styles.rows}>
          {lastRoom ? (
            <LinkRow
              title={t('home.lastRoom')}
              subtitle={
                streak > 1
                  ? `${outcomeLine(t, lastRoom)} · ${t('home.streak', { count: streak })}`
                  : outcomeLine(t, lastRoom)
              }
              onPress={() => router.navigate('/rooms' as Href)}
              icon={
                <View style={[styles.rowIcon, { backgroundColor: theme.surface }]}>
                  <Icon name="rooms" size={16} color={theme.text} />
                </View>
              }
            />
          ) : null}
          {/* Height, job and bio are optional at sign-up: a nudge until they're in. */}
          {missing ? (
            <LinkRow
              title={t('home.completeProfile')}
              subtitle={missing}
              onPress={() => router.push('/profile')}
              icon={
                <View style={[styles.rowIcon, { backgroundColor: theme.surface }]}>
                  <Icon name="add" size={16} color={theme.text} />
                </View>
              }
            />
          ) : null}
          {/* Only for your first few rooms; after that it lives in Settings. */}
          {showHowToPlay ? (
            <LinkRow
              title={t('home.howToPlay')}
              onPress={() => router.push('/how-to-play')}
              icon={
                <View style={[styles.rowIcon, { backgroundColor: theme.surface }]}>
                  <Balloon color={BrandBalloon.color} size={14} />
                </View>
              }
            />
          ) : null}
          {(matches ?? []).map((thread) => {
            const { match } = thread;
            return (
              <LinkRow
                key={match.id}
                title={t('common.nameAge', { name: match.other.name, age: match.other.age })}
                subtitle={previewLine(t, filter, thread, profile.id)}
                accessibilityHint={t('home.openChatHint')}
                onPress={() => router.push({ pathname: '/chat/[id]', params: { id: match.id } })}
                icon={
                  <Avatar
                    name={match.other.name}
                    uri={match.other.photo}
                    tone={seatFor(seats, match.other.id)}
                    size={36}
                  />
                }
              />
            );
          })}
        </Rise>


        {/* On the page, not in a card, so the chips keep their filled shape at rest.
            Only in development: a store build never shows the bots' test controls. */}
        {isMockServer && __DEV__ ? (
          <View style={styles.mock}>
            <ThemedText type="kicker" accessibilityRole="header">
              {t('home.testServer')}
            </ThemedText>
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
            <ThemedText type="footnote" themeColor="textTertiary">
              {t('home.testNote')}
            </ThemedText>
          </View>
        ) : null}
      </Screen>
    </View>
    </TabSwipe>
  );
}

type LinkRowProps = {
  title: string;
  /** The quiet line under the title. Left out where the title says it all. */
  subtitle?: string;
  icon: React.ReactNode;
  onPress: () => void;
  accessibilityHint?: string;
};

/** A row card: a 36 pt icon or avatar, a title over a quiet line, a chevron. */
function LinkRow({ title, subtitle, icon, onPress, accessibilityHint }: LinkRowProps) {
  const theme = useTheme();
  return (
    <PressableHighlight
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      background={theme.field}
      style={[styles.row, { borderColor: theme.border }]}>
      {icon}
      <View style={styles.rowText}>
        <ThemedText type="headline">{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="footnote" themeColor="textSecondary" numberOfLines={2}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <Icon name="chevronRight" size={13} color={theme.textTertiary} />
    </PressableHighlight>
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
  hello: {
    gap: Space.xs,
    marginTop: 40,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  balloonLine: {
    marginTop: Space.sm,
    alignItems: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // The play card: 300 tall, the brand balloon leaning in from the top right.
  card: {
    minHeight: 300,
    marginTop: Space.lg,
    padding: Space.md,
    paddingTop: 22,
    justifyContent: 'space-between',
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cardBalloon: {
    position: 'absolute',
    right: -60,
    top: -40,
    opacity: 0.22,
  },
  cardText: {
    gap: 6,
    paddingHorizontal: 6,
    marginBottom: Space.lg,
    maxWidth: 230,
  },
  cardTitle: {
    fontSize: 28,
    lineHeight: 32,
  },
  rows: {
    gap: 10,
    marginTop: Space.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingVertical: 14,
    paddingHorizontal: Space.md,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  push: {
    marginTop: Space.lg,
  },
  mock: {
    gap: Space.sm,
    marginTop: Space.xl,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.xs,
  },
});
