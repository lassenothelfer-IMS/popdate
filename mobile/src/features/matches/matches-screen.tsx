import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api';
import { TabSwipe } from '@/components/tab-swipe';
import { Avatar } from '@/components/avatar';
import { Balloon } from '@/components/balloon';
import { Button } from '@/components/button';
import { ErrorLine } from '@/components/error-line';
import { PressableHighlight } from '@/components/pressable-highlight';
import { Rise } from '@/components/rise';
import { Screen } from '@/components/screen';
import { Skeleton } from '@/components/skeleton';
import { Bob } from '@/components/stage';
import { TAB_BAR_CLEARANCE, useTabFocus } from '@/components/tab-bar';
import { TextLink } from '@/components/text-link';
import { ThemedText } from '@/components/themed-text';
import { BrandBalloon, Radius, Space } from '@/constants/theme';
import { usePersonActions, type Person } from '@/features/chat/person-actions';
import { useJoinQueue } from '@/features/home/use-join-queue';
import { SecondChances } from '@/features/matches/second-chances';
import { previewLine, withLastMessages, type Thread } from '@/features/matches/threads';
import { seatFor, useSeats, useTheme } from '@/hooks/use-theme';
import { useLocale, useT, type Translate } from '@/i18n';
import { useFilterText } from '@/state/settings';
import { useSession } from '@/state/session';

/** "now", "2 min", "21:40", "Sat", "12 Oct": the newest activity, short. */
function shortTime(t: Translate, locale: string, iso: string) {
  const then = new Date(iso);
  const now = new Date();
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60000);
  try {
    if (minutes < 1) return t('home.timeNow');
    if (minutes < 60) return t('home.timeMinutes', { count: minutes });
    if (then.toDateString() === now.toDateString()) {
      return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(then);
    }
    if (minutes < 6 * 24 * 60) return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(then);
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(then);
  } catch {
    return '';
  }
}

export function MatchesScreen() {
  const t = useT();
  const { profile } = useSession();
  /** Null until the first load: skeleton rows, never a spinner. */
  const [threads, setThreads] = useState<Thread[] | null>(null);
  /** The first load failed: say so, rather than showing "no matches yet". */
  const [failed, setFailed] = useState(false);
  const { join, joining, error } = useJoinQueue();
  // Long-press a row to report, block or unmatch; the row goes once they're gone.
  const people = usePersonActions({
    onGone: (person) =>
      setThreads((current) => current?.filter((thread) => thread.match.other.id !== person.id) ?? null),
  });

  /** Bumped by a pull to refresh, so Almost reloads along with the list. */
  const [refreshes, setRefreshes] = useState(0);

  const loadThreads = useCallback((isCurrent: () => boolean = () => true) => {
    setFailed(false);
    return api
      .listMatches()
      .then(withLastMessages)
      .then(
        (list) => {
          if (isCurrent()) setThreads(list);
        },
        () => {
          if (isCurrent()) setFailed(true);
        },
      );
  }, []);
  // Loads on every visit and each time you page here, and again from Try again.
  useTabFocus(
    useCallback(() => {
      let active = true;
      void loadThreads(() => active);
      return () => {
        active = false;
      };
    }, [loadThreads]),
  );

  // A second chance became a match: the new chat joins the list.
  const reloadThreads = useCallback(() => void loadThreads(), [loadThreads]);

  function refresh() {
    setRefreshes((count) => count + 1);
    return loadThreads();
  }

  const myId = profile?.id ?? null;
  // Newest first. Your turn: they wrote last, or nobody has written yet.
  const sorted = [...(threads ?? [])].sort((a, b) =>
    (b.last?.sentAt ?? b.match.createdAt).localeCompare(a.last?.sentAt ?? a.match.createdAt),
  );
  const yourTurn = sorted.filter((thread) => !thread.last || thread.last.senderId !== myId);
  const earlier = sorted.filter((thread) => thread.last && thread.last.senderId === myId);
  const empty = threads !== null && threads.length === 0;

  return (
    <TabSwipe tab="matches">
    <View style={styles.flex}>
      <Screen
        scroll
        onRefresh={refresh}
        contentStyle={[styles.content, { paddingBottom: TAB_BAR_CLEARANCE }]}>
        <Rise index={0}>
          <ThemedText type="title" accessibilityRole="header" maxFontSizeMultiplier={1.3}>
            {t('home.matchesTitle')}
          </ThemedText>
        </Rise>

        <SecondChances refreshes={refreshes} onMatched={reloadThreads} />

        {threads === null && failed ? (
          <View style={styles.loading}>
            <ErrorLine message={t('home.matchesFailed')} />
            <Button title={t('common.tryAgain')} variant="tinted" onPress={() => void loadThreads()} />
          </View>
        ) : threads === null ? (
          <View style={styles.loading}>
            <Skeleton style={styles.skeletonCard} />
            <Skeleton style={styles.skeletonRow} />
            <Skeleton style={styles.skeletonRow} />
          </View>
        ) : empty ? (
          <EmptyMatches onJoin={join} joining={joining} error={error} />
        ) : (
          <>
            {yourTurn.length > 0 ? (
              <Rise index={1} style={styles.section}>
                <ThemedText type="kicker" accessibilityRole="header">
                  {t('home.yourTurn')}
                </ThemedText>
                {yourTurn.map((thread) => (
                  <ThreadRow
                    key={thread.match.id}
                    thread={thread}
                    myId={myId}
                    highlighted
                    onMore={() => void people.open(personOf(thread))}
                  />
                ))}
              </Rise>
            ) : null}
            {earlier.length > 0 ? (
              <Rise index={2} style={styles.section}>
                <ThemedText type="kicker" accessibilityRole="header">
                  {t('home.earlier')}
                </ThemedText>
                {earlier.map((thread) => (
                  <ThreadRow
                    key={thread.match.id}
                    thread={thread}
                    myId={myId}
                    onMore={() => void people.open(personOf(thread))}
                  />
                ))}
              </Rise>
            ) : null}
            <Rise index={3}>
              <EarnedCard onJoin={join} joining={joining} />
              {error ? <ErrorLine message={error} /> : null}
            </Rise>
          </>
        )}
        {people.element}
      </Screen>
    </View>
    </TabSwipe>
  );
}

/**
 * One conversation. Your turn sits in a card with a coral ring on the avatar;
 * the rest are plain rows with a hairline between them.
 */
function personOf({ match }: Thread): Person {
  return { id: match.other.id, name: match.other.name, age: match.other.age, matchId: match.id };
}

function ThreadRow({
  thread,
  myId,
  highlighted = false,
  onMore,
}: {
  thread: Thread;
  myId: string | null;
  highlighted?: boolean;
  /** Report, block or unmatch: a long press, or the VoiceOver action. */
  onMore: () => void;
}) {
  const theme = useTheme();
  const seats = useSeats();
  const t = useT();
  const locale = useLocale();
  const filter = useFilterText();
  const { match, last } = thread;
  const name = t('common.nameAge', { name: match.other.name, age: match.other.age });
  const preview = previewLine(t, filter, thread, myId);
  const time = shortTime(t, locale, last?.sentAt ?? match.createdAt);
  const quiet = 'textSecondary' as const;
  /** They wrote last: the row says so with a plum dot and a darker preview. */
  const replied = !!last && last.senderId !== myId;
  return (
    <PressableHighlight
      accessibilityRole="button"
      accessibilityLabel={replied ? `${name}. ${t('home.newMessage')}. ${preview}` : `${name}. ${preview}`}
      accessibilityHint={t('home.openChatHint')}
      onPress={() => router.push({ pathname: '/chat/[id]', params: { id: match.id } })}
      onLongPress={onMore}
      accessibilityActions={[{ name: 'more', label: t('chat.optionsHint', { name: match.other.name }) }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'more') onMore();
      }}
      background="transparent"
      style={[styles.thread, styles.threadRow, { borderBottomColor: theme.border }]}>
      <View style={highlighted ? [styles.ring, { borderColor: theme.accent }] : null}>
        <Avatar
          name={match.other.name}
          uri={match.other.photo}
          tone={seatFor(seats, match.other.id)}
          size={56}
        />
      </View>
      <View style={styles.threadText}>
        <View style={styles.threadTop}>
          <ThemedText type="row" style={styles.threadName} numberOfLines={1}>
            {name}
          </ThemedText>
          <ThemedText type="footnote" themeColor={quiet}>
            {time}
          </ThemedText>
        </View>
        <View style={styles.previewRow}>
          <ThemedText
            type="callout"
            themeColor={replied ? 'text' : quiet}
            numberOfLines={1}
            style={[styles.preview, replied && styles.previewNew]}>
            {preview}
          </ThemedText>
          {replied ? <View style={[styles.newDot, { backgroundColor: theme.brand }]} /> : null}
        </View>
      </View>
    </PressableHighlight>
  );
}

/** Under the list: why the list is short, and a way to make it longer. */
function EarnedCard({ onJoin, joining }: { onJoin: () => void; joining: boolean }) {
  const t = useT();
  return (
    <View style={styles.earned}>
      <ThemedText type="heading">{t('home.earnedTitle')}</ThemedText>
      <TextLink title={t('home.play')} loading={joining} onPress={onJoin} />
    </View>
  );
}

/**
 * No matches yet: the words big and to the left, and beside them a balloon in
 * dashes, waiting to be filled. One quiet way in, no black bar.
 */
function EmptyMatches({
  onJoin,
  joining,
  error,
}: {
  onJoin: () => void;
  joining: boolean;
  error: string | null;
}) {
  const theme = useTheme();
  const t = useT();
  return (
    <View style={styles.empty}>
      <Rise index={1}>
        <ThemedText type="hero" accessibilityRole="header" style={styles.emptyTitle}>
          {t('home.emptyTitle')}
        </ThemedText>
      </Rise>
      <Rise index={2} style={styles.emptyRow}>
        <View style={styles.emptyWords}>
          <ThemedText type="body">{t('home.emptyBody')}</ThemedText>
          <TextLink title={t('home.play')} loading={joining} onPress={onJoin} />
          {error ? <ErrorLine message={error} /> : null}
        </View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Bob>
            <Balloon color={BrandBalloon.color} size={112} ghost ghostInk={theme.brand} />
          </Bob>
        </View>
      </Rise>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingTop: Space.sm,
  },
  centered: {
    textAlign: 'center',
  },
  loading: {
    gap: Space.sm,
    marginTop: Space.xl,
  },
  skeletonCard: {
    height: 80,
  },
  skeletonRow: {
    height: 64,
  },
  section: {
    gap: Space.xs,
    marginTop: Space.xl,
  },
  thread: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  threadCard: {
    paddingVertical: Space.sm,
    paddingHorizontal: 14,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  threadRow: {
    paddingVertical: Space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // The coral ring: 2 pt of canvas, then 1.5 pt of coral.
  ring: {
    borderRadius: 32,
    borderWidth: 1.5,
    padding: 2,
    margin: -3.5,
  },
  threadText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  threadTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Space.xs,
  },
  threadName: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: 600,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  preview: {
    flex: 1,
    fontSize: 14,
  },
  previewNew: {
    fontWeight: 600,
  },
  newDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  earned: {
    marginTop: Space.xl,
    gap: Space.md,
  },
  empty: {
    flexGrow: 1,
    marginTop: 56,
  },
  emptyTitle: {
    fontSize: 60,
    lineHeight: 60,
    letterSpacing: -1.8,
    maxWidth: 260,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.md,
    marginTop: Space.xl,
  },
  emptyWords: {
    flex: 1,
    gap: Space.lg,
  },
});
