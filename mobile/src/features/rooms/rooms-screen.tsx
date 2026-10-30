import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MAX_PINNED_ANSWERS, type PinnedAnswer, type RoomSummary } from '@/api/types';
import { Button } from '@/components/button';
import { ErrorLine } from '@/components/error-line';
import { Rise } from '@/components/rise';
import { Screen } from '@/components/screen';
import { Skeleton } from '@/components/skeleton';
import { TAB_BAR_CLEARANCE } from '@/components/tab-bar';
import { TabSwipe } from '@/components/tab-swipe';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/toast';
import { Radius, Space } from '@/constants/theme';
import { acknowledge } from '@/features/chat/prompts';
import { useJoinQueue } from '@/features/home/use-join-queue';
import { roomStats, useRoomHistory } from '@/features/rooms/use-room-history';
import { useTheme } from '@/hooks/use-theme';
import { useLocale, useT, type Translate } from '@/i18n';
import { useSession } from '@/state/session';
import { haptics } from '@/utils/haptics';

/** How a room ended for you, in a few words. */
export function outcomeLine(t: Translate, room: RoomSummary) {
  switch (room.outcome) {
    case 'won':
      return t('rooms.outcomeWon');
    case 'chose':
      return t('rooms.outcomeChose', { name: room.matchName ?? '' });
    case 'left':
      return t('rooms.outcomeLeft');
    default:
      // No round on record: just how it ended, never a made-up round 1.
      return room.poppedInRound === null
        ? t('rooms.outcomePoppedNoRound')
        : t('rooms.outcomePopped', { round: room.poppedInRound });
  }
}

function samePin(a: PinnedAnswer, b: PinnedAnswer) {
  return a.question === b.question && a.answer === b.answer;
}

/**
 * Your rooms, newest first: how each one went, the questions and your answers,
 * with Pin to put an answer on your profile, and the recap or chat it led to.
 */
export function RoomsScreen() {
  const t = useT();
  const { profile, updateProfile } = useSession();
  const { history, failed, reload } = useRoomHistory();
  const { join, joining, error } = useJoinQueue();
  const { show, toast } = useToast();
  const [pinning, setPinning] = useState(false);
  const pins = profile?.pinnedAnswers ?? [];

  async function togglePin(pin: PinnedAnswer) {
    if (pinning) return;
    const pinned = pins.some((p) => samePin(p, pin));
    if (!pinned && pins.length >= MAX_PINNED_ANSWERS) {
      acknowledge(t('rooms.pinLimitTitle'), t('rooms.pinLimitBody', { count: MAX_PINNED_ANSWERS }));
      return;
    }
    setPinning(true);
    try {
      await updateProfile({
        pinnedAnswers: pinned ? pins.filter((p) => !samePin(p, pin)) : [...pins, pin],
      });
      haptics.selection();
      show(pinned ? t('rooms.unpinned') : t('rooms.pinned'));
    } catch {
      haptics.error();
      show(t('rooms.pinFailed'));
    } finally {
      setPinning(false);
    }
  }

  const stats = history ? roomStats(history) : null;

  return (
    <TabSwipe tab="rooms">
      <View style={styles.flex}>
        <Screen
          scroll
          onRefresh={reload}
          contentStyle={[styles.content, { paddingBottom: TAB_BAR_CLEARANCE }]}>
          <Rise index={0}>
            <ThemedText type="title" accessibilityRole="header" maxFontSizeMultiplier={1.3}>
              {t('rooms.title')}
            </ThemedText>
            {stats && stats.played > 0 ? (
              <ThemedText type="callout" themeColor="textSecondary" style={styles.summary}>
                {t('rooms.summary', { count: stats.played, won: stats.lastBalloon })}
              </ThemedText>
            ) : null}
          </Rise>

          {history === null && failed ? (
            <View style={styles.list}>
              <ErrorLine message={t('rooms.failed')} />
              <Button title={t('common.tryAgain')} variant="tinted" onPress={() => void reload()} />
            </View>
          ) : history === null ? (
            <View style={styles.list}>
              <Skeleton style={styles.skeleton} />
              <Skeleton style={styles.skeleton} />
            </View>
          ) : history.length === 0 ? (
            <Rise index={1} style={styles.empty}>
              <ThemedText type="display" style={styles.centered}>
                {t('rooms.emptyTitle')}
              </ThemedText>
              <ThemedText type="callout" themeColor="textSecondary" style={styles.centered}>
                {t('rooms.emptyBody')}
              </ThemedText>
              <Button title={t('home.play')} loading={joining} onPress={() => void join()} />
              {error ? <ErrorLine message={error} /> : null}
            </Rise>
          ) : (
            <View style={styles.list}>
              {history.map((room, index) => (
                <Rise key={room.roomId} index={Math.min(index + 1, 4)}>
                  <RoomCard room={room} pins={pins} pinning={pinning} onPin={togglePin} />
                </Rise>
              ))}
            </View>
          )}
        </Screen>
        {toast}
      </View>
    </TabSwipe>
  );
}

type RoomCardProps = {
  room: RoomSummary;
  pins: PinnedAnswer[];
  pinning: boolean;
  onPin: (pin: PinnedAnswer) => void;
};

/** One room: when, how it went, each question with your answer, and where it led. */
function RoomCard({ room, pins, pinning, onPin }: RoomCardProps) {
  const t = useT();
  const theme = useTheme();
  const locale = useLocale();
  const date = new Date(room.endedAt).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const answered = room.rounds.filter((round) => round.question);
  return (
    <View style={[styles.card, { backgroundColor: theme.field, borderColor: theme.border }]}>
      <View style={styles.cardTop}>
        <ThemedText type="kicker">{date}</ThemedText>
        <ThemedText type="captionStrong" themeColor={room.outcome === 'won' || room.outcome === 'chose' ? 'accentText' : 'textSecondary'}>
          {outcomeLine(t, room)}
        </ThemedText>
      </View>
      <ThemedText type="footnote" themeColor="textSecondary">
        {room.role === 'popper' ? t('rooms.youChose') : t('rooms.theyChose', { name: room.popperName })}
      </ThemedText>

      {answered.map((round, i) => {
        const pin = round.answer ? { question: round.question, answer: round.answer } : null;
        const pinned = pin ? pins.some((p) => samePin(p, pin)) : false;
        return (
          <View key={`${room.roomId}-${i}`} style={[styles.round, { borderTopColor: theme.border }]}>
            <ThemedText type="questionRow">{round.question}</ThemedText>
            {pin ? (
              <View style={styles.answerRow}>
                <ThemedText type="callout" themeColor="textSecondary" style={styles.answer}>
                  {`“${pin.answer}”`}
                </ThemedText>
                <Button
                  title={pinned ? t('rooms.unpin') : t('rooms.pin')}
                  variant={pinned ? 'tinted' : 'plain'}
                  size="small"
                  fullWidth={false}
                  disabled={pinning}
                  accessibilityHint={t('rooms.pinHint')}
                  onPress={() => onPin(pin)}
                />
              </View>
            ) : room.role === 'contestant' ? (
              <ThemedText type="footnote" themeColor="textTertiary">
                {t('rooms.noAnswer')}
              </ThemedText>
            ) : null}
          </View>
        );
      })}

      {/* Wraps, so a long name or a longer language puts Chat under the recap instead of cutting it. */}
      <View style={styles.actions}>
        <Button
          title={t('rooms.recap')}
          variant="plain"
          fullWidth={false}
          onPress={() => router.push(`/recap/${room.roomId}` as Href)}
        />
        {room.matchId ? (
          <Button
            title={t('rooms.openChat', { name: room.matchName ?? '' })}
            variant="tinted"
            size="small"
            fullWidth={false}
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: room.matchId! } })}
          />
        ) : null}
      </View>
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
  summary: {
    marginTop: Space.xs,
  },
  list: {
    marginTop: Space.lg,
    gap: Space.md,
  },
  skeleton: {
    height: 180,
    borderRadius: Radius.xl,
  },
  empty: {
    marginTop: 80,
    gap: Space.md,
  },
  centered: {
    textAlign: 'center',
  },
  card: {
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    padding: Space.md,
    gap: Space.xs,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Space.sm,
  },
  round: {
    marginTop: Space.xs,
    paddingTop: Space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  answer: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.xs,
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Space.xs,
  },
});
