import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn,
  FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';

import { MAX_PINNED_ANSWERS, type PinnedAnswer, type RoomSummary } from '@/api/types';
import { SlotPhoto } from '@/components/backdrop';
import { Balloon } from '@/components/balloon';
import { Button } from '@/components/button';
import { ErrorLine } from '@/components/error-line';
import { Icon } from '@/components/icon';
import { PressableHighlight } from '@/components/pressable-highlight';
import { Rise } from '@/components/rise';
import { Screen } from '@/components/screen';
import { Skeleton } from '@/components/skeleton';
import { Bob } from '@/components/stage';
import { TAB_BAR_CLEARANCE } from '@/components/tab-bar';
import { TabSwipe } from '@/components/tab-swipe';
import { TextLink } from '@/components/text-link';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/toast';
import { Imagery } from '@/constants/imagery';
import { BrandBalloon, CssEase, Ease, Fonts, MinTouch, Motion, Radius, Space } from '@/constants/theme';
import { acknowledge } from '@/features/chat/prompts';
import { useJoinQueue } from '@/features/home/use-join-queue';
import { roomStats, useRoomHistory } from '@/features/rooms/use-room-history';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useSeats, useTheme } from '@/hooks/use-theme';
import { useLocale, useT, type Translate } from '@/i18n';
import { useSession } from '@/state/session';
import { haptics } from '@/utils/haptics';
import { nativeOnly } from '@/utils/web-motion';

/**
 * The rooms under one that opens or folds slide to their new place. Off under
 * Reduce Motion, and on web, where it would stretch a card that changes size.
 */
const cardMove = nativeOnly(LinearTransition.duration(Motion.enter).easing(Ease.inOut));
/** An opened room's questions and answers fade in, and fade out again as it folds. */
const detailsIn = FadeIn.duration(Motion.state).easing(Ease.out).reduceMotion(ReduceMotion.Never);
const detailsOut = FadeOut.duration(Motion.exit).easing(Ease.out).reduceMotion(ReduceMotion.Never);

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

/**
 * The rounds you were there for: all of them as the chooser or the last balloon,
 * up to the one you were popped or left in, or else just the ones you answered.
 */
function roundsYouSaw(room: RoomSummary) {
  const asked = room.rounds.filter((round) => round.question);
  if (room.role === 'popper' || room.outcome === 'won' || room.outcome === 'chose') return asked;
  if (room.poppedInRound !== null) return room.rounds.slice(0, room.poppedInRound).filter((round) => round.question);
  return asked.filter((round) => round.answer);
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
  const reduced = useReduceMotion();
  /** Rooms you opened or folded yourself. The rest: the newest open, the others folded. */
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
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
              <ThemedText type="body" style={styles.summary}>
                {t('rooms.summary', {
                  count: stats.played,
                  wins: t('rooms.summaryWins', { count: stats.lastBalloon }),
                })}
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
            <EmptyRooms joining={joining} error={error} onJoin={() => void join()} />
          ) : (
            <View style={styles.list}>
              {history.map((room, index) => {
                const open = toggled[room.roomId] ?? index === 0;
                return (
                  <Animated.View key={room.roomId} layout={reduced ? undefined : cardMove}>
                    <Rise index={Math.min(index + 1, 4)}>
                      <RoomCard
                        room={room}
                        open={open}
                        // Only a room you open yourself fades in; the newest is just there.
                        fadeIn={room.roomId in toggled}
                        onToggle={() => setToggled((previous) => ({ ...previous, [room.roomId]: !open }))}
                        pins={pins}
                        pinning={pinning}
                        onPin={togglePin}
                      />
                    </Rise>
                  </Animated.View>
                );
              })}
            </View>
          )}
        </Screen>
        {toast}
      </View>
    </TabSwipe>
  );
}

/** No rooms yet: a photo the width of the phone, then the words and one quiet way in. */
function EmptyRooms({ joining, error, onJoin }: { joining: boolean; error: string | null; onJoin: () => void }) {
  const t = useT();
  return (
    <View style={styles.empty}>
      <Rise index={1}>
        <SlotPhoto slot={Imagery.emptyRooms} />
      </Rise>
      <Rise index={2} style={styles.emptyWords}>
        <ThemedText type="display" accessibilityRole="header">
          {t('rooms.emptyTitle')}
        </ThemedText>
        <ThemedText type="body">{t('rooms.emptyBody')}</ThemedText>
        <TextLink title={t('home.play')} loading={joining} onPress={onJoin} />
        {error ? <ErrorLine message={error} /> : null}
      </Rise>
    </View>
  );
}

type RoomCardProps = {
  room: RoomSummary;
  /** Showing its questions and answers, or folded to its one line. */
  open: boolean;
  /** Fade the questions in as it opens. */
  fadeIn: boolean;
  onToggle: () => void;
  pins: PinnedAnswer[];
  pinning: boolean;
  onPin: (pin: PinnedAnswer) => void;
};

/**
 * One room, as an entry in a journal: a balloon in the margin for how it ended
 * (whole when it ended with a match, torn when you were popped or left), the
 * day, how it went, and one thing you said. Open: who was choosing, each
 * question with your answer, and where it led. The top opens and folds it.
 */
function RoomCard({ room, open, fadeIn, onToggle, pins, pinning, onPin }: RoomCardProps) {
  const t = useT();
  const theme = useTheme();
  const seats = useSeats();
  const locale = useLocale();
  const reduced = useReduceMotion();
  const date = new Date(room.endedAt).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const outcome = outcomeLine(t, room);
  const answered = roundsYouSaw(room);
  // A room you left may still be playing, so there's no recap to see.
  const showRecap = room.outcome !== 'left';
  const matched = room.outcome === 'won' || room.outcome === 'chose';
  /** Something you said in it, under the headline while the entry is folded. */
  const said = answered.find((round) => round.answer)?.answer ?? null;
  return (
    <View style={[styles.card, { borderBottomColor: theme.border }]}>
      <PressableHighlight
        accessibilityRole="button"
        accessibilityLabel={`${date}, ${outcome}`}
        accessibilityState={{ expanded: open }}
        accessibilityHint={open ? t('rooms.foldHint') : t('rooms.openHint')}
        onPress={onToggle}
        background={theme.page}
        style={styles.cardTop}>
        <View style={styles.mark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {matched ? (
            <Balloon color={BrandBalloon.color} size={24} />
          ) : (
            <Balloon color={seats[1].color} size={24} popped />
          )}
        </View>
        <View style={styles.entry}>
          <ThemedText style={styles.day}>{date}</ThemedText>
          <ThemedText type="heading">{outcome}</ThemedText>
          {!open && said ? (
            <ThemedText style={styles.said} numberOfLines={2}>
              {said}
            </ThemedText>
          ) : null}
        </View>
        {/* Points right while folded, down while open. */}
        <Animated.View
          style={{
            transform: [{ rotate: open ? '90deg' : '0deg' }],
            transitionProperty: 'transform',
            transitionDuration: reduced ? 0 : Motion.state,
            transitionTimingFunction: CssEase.out,
          }}>
          <Icon name="chevronRight" size={13} color={theme.text} />
        </Animated.View>
      </PressableHighlight>

      {open ? (
        <Animated.View
          entering={fadeIn ? detailsIn : undefined}
          exiting={fadeIn ? detailsOut : undefined}
          style={styles.cardBody}>
          <ThemedText type="body">
            {room.role === 'popper' ? t('rooms.youChose') : t('rooms.theyChose', { name: room.popperName })}
          </ThemedText>

          {answered.map((round, i) => {
            const pin = round.answer ? { question: round.question, answer: round.answer } : null;
            const pinned = pin ? pins.some((p) => samePin(p, pin)) : false;
            return (
              <View key={`${room.roomId}-${i}`} style={[styles.round, { borderTopColor: theme.border }]}>
                <ThemedText style={styles.asked}>{round.question}</ThemedText>
                {pin ? (
                  <View style={styles.answerRow}>
                    <ThemedText style={[styles.answer, styles.said]}>{pin.answer}</ThemedText>
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
                  <ThemedText type="callout" themeColor="textSecondary">
                    {t('rooms.noAnswer')}
                  </ThemedText>
                ) : null}
              </View>
            );
          })}

          {/* Wraps, so a long name or a longer language puts Chat under the recap instead of cutting it. */}
          {showRecap || room.matchId ? (
            <View style={styles.actions}>
              {showRecap ? (
                <Button
                  title={t('rooms.recap')}
                  variant="plain"
                  fullWidth={false}
                  onPress={() => router.push(`/recap/${room.roomId}` as Href)}
                />
              ) : null}
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
          ) : null}
        </Animated.View>
      ) : null}
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
    marginTop: Space.md,
  },
  skeleton: {
    height: 180,
    borderRadius: Radius.xl,
  },
  empty: {
    marginTop: Space.md,
    gap: Space.xs,
  },
  emptyWords: {
    gap: Space.md,
  },
  // One entry: no box, a hairline under it.
  card: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // The whole top is the open and fold target.
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.sm,
    minHeight: MinTouch,
    paddingVertical: Space.md,
  },
  mark: {
    width: 26,
    paddingTop: 2,
  },
  entry: {
    flex: 1,
    gap: 4,
  },
  // The day a room was played, at reading size.
  day: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 600,
  },
  cardBody: {
    paddingLeft: 26 + Space.sm,
    paddingBottom: Space.md,
    gap: Space.xs,
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
  // A question is small and in the system font; what was said is large and in the serif.
  asked: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: 600,
  },
  said: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.3,
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
