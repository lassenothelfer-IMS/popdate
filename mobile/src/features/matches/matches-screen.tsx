import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { api, type Match, type Message } from '@/api';
import { Avatar } from '@/components/avatar';
import { Balloon } from '@/components/balloon';
import { Button } from '@/components/button';
import { ErrorLine } from '@/components/error-line';
import { PressableHighlight } from '@/components/pressable-highlight';
import { Rise } from '@/components/rise';
import { Screen } from '@/components/screen';
import { Skeleton } from '@/components/skeleton';
import { TAB_BAR_CLEARANCE } from '@/components/tab-bar';
import { ThemedText } from '@/components/themed-text';
import { BrandBalloon, Radius, Space } from '@/constants/theme';
import { usePersonActions, type Person } from '@/features/chat/person-actions';
import { useJoinQueue } from '@/features/home/use-join-queue';
import { seatFor, useSeats, useTheme } from '@/hooks/use-theme';
import { useLocale, useT, type Translate } from '@/i18n';
import { useFilterText } from '@/state/settings';
import { useSession } from '@/state/session';

/** A match with its newest message, if anyone has written yet. */
type Thread = { match: Match; last: Message | null };

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

  // Loads on every visit, and again from Try again.
  const load = useCallback(() => {
    let active = true;
    setFailed(false);
    api
      .listMatches()
      .then((matches) =>
        Promise.all(
          matches.map(async (match) => {
            const messages = await api.listMessages(match.id).catch(() => []);
            return { match, last: messages.at(-1) ?? null };
          }),
        ),
      )
      .then((list) => {
        if (active) setThreads(list);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useFocusEffect(load);

  const myId = profile?.id ?? null;
  // Newest first. Your turn: they wrote last, or nobody has written yet.
  const sorted = [...(threads ?? [])].sort((a, b) =>
    (b.last?.sentAt ?? b.match.createdAt).localeCompare(a.last?.sentAt ?? a.match.createdAt),
  );
  const yourTurn = sorted.filter((thread) => !thread.last || thread.last.senderId !== myId);
  const earlier = sorted.filter((thread) => thread.last && thread.last.senderId === myId);
  const empty = threads !== null && threads.length === 0;

  return (
    <View style={styles.flex}>
      <Screen scroll contentStyle={[styles.content, { paddingBottom: TAB_BAR_CLEARANCE }]}>
        <Rise index={0}>
          <ThemedText type="title" accessibilityRole="header" maxFontSizeMultiplier={1.3}>
            {t('home.matchesTitle')}
          </ThemedText>
        </Rise>

        {threads === null && failed ? (
          <View style={styles.loading}>
            <ErrorLine message={t('home.matchesFailed')} />
            <Button title={t('common.tryAgain')} variant="tinted" onPress={() => void load()} />
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
  const preview = last
    ? last.senderId === myId
      ? t('home.youWrote', { text: last.text })
      : filter(last.text)
    : t('home.matchNote');
  const time = shortTime(t, locale, last?.sentAt ?? match.createdAt);
  const quiet = highlighted ? 'textSecondary' : 'textTertiary';
  return (
    <PressableHighlight
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${preview}`}
      accessibilityHint={t('home.openChatHint')}
      onPress={() => router.push({ pathname: '/chat/[id]', params: { id: match.id } })}
      onLongPress={onMore}
      accessibilityActions={[{ name: 'more', label: t('chat.optionsHint', { name: match.other.name }) }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'more') onMore();
      }}
      background={highlighted ? theme.field : 'transparent'}
      style={[
        styles.thread,
        highlighted
          ? [styles.threadCard, { borderColor: theme.border }]
          : [styles.threadRow, { borderBottomColor: theme.border }],
      ]}>
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
          <ThemedText type="caption" themeColor={quiet}>
            {time}
          </ThemedText>
        </View>
        <ThemedText type="callout" themeColor={quiet} numberOfLines={1} style={styles.preview}>
          {preview}
        </ThemedText>
      </View>
    </PressableHighlight>
  );
}

/** Under the list: why the list is short, and a way to make it longer. */
function EarnedCard({ onJoin, joining }: { onJoin: () => void; joining: boolean }) {
  const theme = useTheme();
  const t = useT();
  return (
    <View style={[styles.earned, { backgroundColor: theme.field, borderColor: theme.border }]}>
      <ThemedText type="questionRow">{t('home.earnedTitle')}</ThemedText>
      <ThemedText type="callout" themeColor="textSecondary" style={styles.earnedBody}>
        {t('home.earnedBody')}
      </ThemedText>
      <View style={styles.earnedButton}>
        <Button title={t('home.play')} variant="tinted" loading={joining} onPress={onJoin} />
      </View>
    </View>
  );
}

/** No matches yet: the brand balloon on a gold string, one line of why, and the way in. */
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
      <Rise index={1} style={styles.emptyArt}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.emptyArt}>
          <Balloon color={BrandBalloon.color} size={120} string={false} />
          <Svg width={8} height={70} style={styles.emptyString}>
            <Defs>
              <LinearGradient id="matchesEmptyString" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.gold} stopOpacity={1} />
                <Stop offset="1" stopColor={theme.gold} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x={3} width={2} height={70} fill="url(#matchesEmptyString)" />
          </Svg>
        </View>
      </Rise>
      <Rise index={2} style={styles.emptyText}>
        <ThemedText type="display" style={styles.centered}>
          {t('home.emptyTitle')}
        </ThemedText>
        <ThemedText type="body" themeColor="textSecondary" style={[styles.centered, styles.emptyBody]}>
          {t('home.emptyBody')}
        </ThemedText>
      </Rise>
      <Rise index={3} style={styles.emptyAction}>
        <Button title={t('home.play')} loading={joining} onPress={onJoin} />
        {error ? <ErrorLine message={error} /> : null}
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
  preview: {
    fontSize: 14,
  },
  earned: {
    marginTop: Space.xl,
    padding: 18,
    gap: 6,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  earnedBody: {
    fontSize: 14,
    lineHeight: 19,
  },
  earnedButton: {
    marginTop: Space.xs,
  },
  empty: {
    flexGrow: 1,
    marginTop: 64,
  },
  emptyArt: {
    alignItems: 'center',
  },
  emptyString: {
    marginTop: -2,
    transform: [{ rotate: '6deg' }],
    transformOrigin: 'top',
  },
  emptyText: {
    alignItems: 'center',
    gap: 10,
    marginTop: Space.md,
  },
  emptyBody: {
    maxWidth: 300,
    fontSize: 16,
  },
  emptyAction: {
    marginTop: Space.xl,
    gap: Space.sm,
  },
});
