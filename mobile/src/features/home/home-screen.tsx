import { Redirect, router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  api,
  getMockNextRole,
  isMockServer,
  setMockNextRole,
  type Match,
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
import { TAB_BAR_CLEARANCE } from '@/components/tab-bar';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { BrandBalloon, Radius, Space } from '@/constants/theme';
import { outcomeLine } from '@/features/rooms/rooms-screen';
import { roomStats, useRoomHistory } from '@/features/rooms/use-room-history';
import { useJoinQueue } from '@/features/home/use-join-queue';
import { seatFor, useSeats, useTheme, youSeat } from '@/hooks/use-theme';
import { useLocale, useT, type Translate } from '@/i18n';
import { useSession } from '@/state/session';

/** The test server's role chips, labeled by their `home.*` keys. */
const MOCK_ROLES: { role: MockRole; label: string }[] = [
  { role: 'random', label: 'home.roleRandom' },
  { role: 'popper', label: 'home.rolePopper' },
  { role: 'contestant', label: 'home.roleBalloon' },
];

/** Home shows your newest matches; the Matches tab has them all. */
/** How often the live queue line refreshes while Home is open. */
const LIVE_REFRESH_MS = 20_000;
const HOME_MATCHES = 2;

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

export function HomeScreen() {
  const { profile } = useSession();
  const seats = useSeats();
  const theme = useTheme();
  const t = useT();
  const locale = useLocale();
  /** Null until the first load, so nothing flashes before the rows. */
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [mockRole, setMockRole] = useState(getMockNextRole);
  const { join, joining, error } = useJoinQueue();
  const [live, setLive] = useState<QueueStats | null>(null);
  const { history } = useRoomHistory();
  const lastRoom = history?.[0];
  const streak = history ? roomStats(history).streak : 0;

  // Who's queuing right now: fetched on every visit, then every 20 s while you're here.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const check = () =>
        api
          .getQueueStats()
          .then((stats) => {
            if (active) setLive(stats);
          })
          .catch(() => {});
      void check();
      const timer = setInterval(check, LIVE_REFRESH_MS);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      api
        .listMatches()
        .then((list) => {
          if (active) setMatches(list);
        })
        .catch(() => {
          if (active) setMatches((previous) => previous ?? []);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  if (!profile) return <Redirect href="/" />;

  function chooseMockRole(role: MockRole) {
    setMockNextRole(role);
    setMockRole(role);
  }

  const words = greeting(t, locale, profile.name, profile.city);
  const newest = [...(matches ?? [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, HOME_MATCHES);
  const you = youSeat(seats);

  return (
    <TabSwipe tab="home">
    <View style={styles.flex}>
      <Screen scroll contentStyle={[styles.content, { paddingBottom: TAB_BAR_CLEARANCE }]}>
        <Rise index={0} style={styles.top}>
          <Wordmark />
          <PressableHighlight
            accessibilityRole="button"
            accessibilityLabel={t('home.yourProfile')}
            onPress={() => router.navigate('/you' as Href)}
            background="transparent"
            style={styles.avatarButton}>
            <Avatar name={profile.name} uri={profile.photos[0]} tone={you} size={40} />
          </PressableHighlight>
        </Rise>

        <Rise index={1} style={styles.hello}>
          <View style={styles.liveRow}>
            <View style={[styles.liveDot, { backgroundColor: theme.success }]} />
            <ThemedText type="kicker">
              {live
                ? t('home.liveLine', { count: live.waiting, city: profile.city })
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
              <Balloon color={BrandBalloon.color} size={260} string={false} />
            </View>
            <View style={styles.cardText}>
              <ThemedText type="kicker">{t('home.cardLabel', { city: profile.city })}</ThemedText>
              <ThemedText type="display" style={styles.cardTitle} maxFontSizeMultiplier={1.3}>
                {t('home.cardTitle')}
              </ThemedText>
              <ThemedText type="callout" themeColor="textSecondary" style={styles.cardNote}>
                {t('home.roleNote')}
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
          {live ? (
            <ThemedText type="footnote" themeColor="textSecondary" style={styles.liveNote}>
              {t('home.roomsLastHour', { count: live.roomsLastHour })}
            </ThemedText>
          ) : null}
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
          {profile.heightCm === null || !profile.job || !profile.bio ? (
            <LinkRow
              title={t('home.completeProfile')}
              subtitle={t('home.completeProfileNote')}
              onPress={() => router.push('/profile')}
              icon={
                <View style={[styles.rowIcon, { backgroundColor: theme.surface }]}>
                  <Icon name="add" size={16} color={theme.text} />
                </View>
              }
            />
          ) : null}
          <LinkRow
            title={t('home.howToPlay')}
            subtitle={t('home.howToPlayNote')}
            onPress={() => router.push('/how-to-play')}
            icon={
              <View style={[styles.rowIcon, { backgroundColor: theme.surface }]}>
                <Balloon color={BrandBalloon.color} size={14} string={false} />
              </View>
            }
          />
          {newest.map((match) => (
            <LinkRow
              key={match.id}
              title={t('common.nameAge', { name: match.other.name, age: match.other.age })}
              subtitle={t('home.matchNote')}
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
          ))}
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
  subtitle: string;
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
        <ThemedText type="footnote" themeColor="textSecondary" numberOfLines={1}>
          {subtitle}
        </ThemedText>
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
  avatarButton: {
    borderRadius: 22,
    padding: 2,
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
  liveNote: {
    marginTop: Space.xs,
    textAlign: 'center',
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
    opacity: 0.9,
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
  cardNote: {
    marginTop: Space.xxs,
    fontSize: 14,
    lineHeight: 19,
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
