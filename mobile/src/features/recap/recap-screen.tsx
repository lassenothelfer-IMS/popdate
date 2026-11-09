import { router } from 'expo-router';
import { useEffect, useId, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { Room } from '@/api';
import { Balloon, PoppedMark } from '@/components/balloon';
import { Button } from '@/components/button';
import { LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { Colors, Ease, Fonts, SeatColors, Space } from '@/constants/theme';
import { MoreButton, usePersonActions, type Person } from '@/features/chat/person-actions';
import { BackButton } from '@/features/onboarding/back-button';
import { useRoomHistory } from '@/features/rooms/use-room-history';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useRoom } from '@/hooks/use-server';
import { seatAt } from '@/hooks/use-theme';
import { useT, useLocale } from '@/i18n';
import { useSession } from '@/state/session';
import { goHome } from '@/utils/navigation';
import { webSafeKeyframe } from '@/utils/web-motion';

/** The recap card is always drawn in Cream, whatever the app's theme, so it shares the same everywhere. */
const paper = Colors;
const paperSeats = SeatColors;
/** The card is 340 pt wide at most and as tall as what it holds. */
const CARD = { width: 340, radius: 24, padding: 24 };
/** Taller than any card, so the sheen always crosses all of it. */
const SHEEN_HEIGHT = 1200;

/** The card rises 80 pt and unfolds from an 18 degree tilt, over 1 s. */
const cardIn = webSafeKeyframe(
  new Keyframe({
    0: { opacity: 0, transform: [{ perspective: 800 }, { translateY: 80 }, { rotateX: '18deg' }, { scale: 0.92 }] },
    100: {
      opacity: 1,
      transform: [{ perspective: 800 }, { translateY: 0 }, { rotateX: '0deg' }, { scale: 1 }],
      easing: Ease.rise,
    },
  })
    .duration(1000)
    .delay(200),
);

/** The sections fade up 10 pt, 150 ms apart from 800 ms. */
function statIn(index: number) {
  return webSafeKeyframe(
    new Keyframe({
      0: { opacity: 0, transform: [{ translateY: 10 }] },
      100: { opacity: 1, transform: [{ translateY: 0 }], easing: Ease.rise },
    })
      .duration(700)
      .delay(800 + index * 150),
  );
}

export function RecapScreen({ roomId }: { roomId: string }) {
  const t = useT();
  const room = useRoom(roomId);
  if (room === undefined) return <LoadingScreen label={t('match.recapLoading')} />;
  if (room === null || room.status !== 'finished') {
    // Still being played: its recap comes once it ends. Gone: nothing to show.
    return (
      <Screen
        scroll
        contentStyle={styles.centered}
        footerStyle="plain"
        footer={<Button title={t('match.backHome')} onPress={goHome} />}>
        <ThemedText themeColor="textSecondary" style={styles.centeredText}>
          {room === null ? t('match.recapGone') : t('rooms.recapInProgress')}
        </ThemedText>
      </Screen>
    );
  }
  return <Recap room={room} />;
}

type Round = { number: number; question: string | null; popped: string[]; gotMe: boolean };

function Recap({ room }: { room: Room }) {
  const t = useT();
  const locale = useLocale();
  const { profile } = useSession();
  const reduced = useReduceMotion();
  const { history } = useRoomHistory();
  // Read once, so rendering stays pure.
  const [today] = useState(() => Date.now());
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(CARD.width, windowWidth - 2 * Space.lg);
  const seatWidth = (width - 2 * CARD.padding) / Math.max(room.contestants.length, 1);

  const meId = room.me.id;
  // Report or block anyone from the room; your match comes with Unmatch too.
  const people = usePersonActions({ onGone: goHome });
  const others: Person[] = [room.popper, ...room.contestants]
    .filter((player) => player.id !== meId)
    .map((player) => ({
      id: player.id,
      name: player.name,
      age: player.age,
      matchId:
        room.matchId && (player.id === room.winnerId || player.id === room.popper.id)
          ? room.matchId
          : undefined,
    }));
  const chooser = room.popper;
  const winner = room.contestants.find((c) => c.id === room.winnerId) ?? null;
  const headline = !winner
    ? t('match.recapNoMatch')
    : chooser.id === meId
      ? t('match.youChose', { name: winner.name })
      : winner.id === meId
        ? t('match.choseYou', { name: chooser.name })
        : t('match.recapChose', { chooser: chooser.name, winner: winner.name });

  const me = room.contestants.find((c) => c.id === meId) ?? null;
  // Rounds you got through: all of them if you held on, one fewer than the round you popped in.
  const survived = me ? (me.popped && me.poppedInRound ? me.poppedInRound - 1 : room.totalRounds) : null;
  const lastAnswer = me?.answer ?? null;

  // Each round's question comes from your room history; the room itself only keeps the last one.
  const summary = history?.find((entry) => entry.roomId === room.id) ?? null;
  const playedRounds = Math.max(
    summary?.rounds.length ?? 0,
    ...room.contestants.map((c) => c.poppedInRound ?? 0),
    room.round,
  );
  const rounds: Round[] = Array.from({ length: playedRounds }, (_, i) => {
    const number = i + 1;
    const out = room.contestants.filter((c) => c.popped && c.poppedInRound === number);
    return {
      number,
      question: summary?.rounds[i]?.question || (number === room.round ? (room.question?.text ?? null) : null),
      popped: out.map((c) => (c.id === meId ? t('common.you') : c.name)),
      gotMe: out.some((c) => c.id === meId),
    };
  }).filter((round) => round.question || round.popped.length > 0);

  // The day the room ended, from your history; today until the history has it.
  const endedAt = summary ? Date.parse(summary.endedAt) : NaN;
  const day = new Date(Number.isNaN(endedAt) ? today : endedAt);
  let dateLine = '';
  try {
    dateLine = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(day);
  } catch {
    dateLine = day.toDateString();
  }
  if (profile?.city) dateLine = `${profile.city}, ${dateLine}`;

  let section = 0;
  return (
    <Screen
      scroll
      footerStyle="plain"
      contentStyle={styles.content}
      footer={<Button title={t('match.backHome')} onPress={goHome} />}>
      <View style={styles.top}>
        <BackButton onPress={() => (router.canGoBack() ? router.back() : goHome())} />
        <MoreButton
          label={t('game.reportSomeone')}
          disabled={people.busy}
          onPress={() => void people.openAmong(others)}
        />
      </View>
      {people.element}

      <View style={styles.stage}>
        <Animated.View
          entering={reduced ? undefined : cardIn}
          accessible
          accessibilityLabel={t('match.recapCard')}
          style={[
            styles.card,
            {
              width,
              backgroundColor: paper.page,
              boxShadow: `0 40px 80px -30px rgba(0,0,0,0.9), inset 0 0 0 1px ${paper.border}`,
            },
          ]}>
          <Sheen reduced={reduced} />
          <Wordmark size={16} compact />
          <Text style={[styles.meta, { color: paper.textSecondary }]}>{dateLine}</Text>

          <View style={styles.headline}>
            <Text style={[styles.label, { color: paper.textSecondary }]}>{t('match.recapKicker')}</Text>
            <Text style={[styles.hero, { color: paper.text }]}>{headline}</Text>
          </View>

          <Animated.View entering={reduced ? undefined : statIn(section++)} style={styles.section}>
            <Text style={[styles.label, { color: paper.textSecondary }]}>{t('match.recapRoom')}</Text>
            <View
              style={styles.seats}
              accessible
              accessibilityLabel={t('match.recapRoomLabel', { count: room.contestants.length })}>
              {room.contestants.map((c, i) => {
                const color = seatAt(paperSeats, i).color;
                const isWinner = c.id === room.winnerId;
                const note = isWinner
                  ? room.matchId
                    ? t('match.recapMatch')
                    : t('match.recapLast')
                  : c.popped && c.poppedInRound
                    ? t('match.recapRoundN', { n: c.poppedInRound })
                    : '';
                return (
                  <View key={c.id} style={[styles.seat, { width: seatWidth }]}>
                    <View style={styles.seatBalloon}>
                      {c.popped ? (
                        // In paper ink: the light seat colors barely show on Cream.
                        <PoppedMark color={paper.textSecondary} size={26} />
                      ) : (
                        <Balloon color={color} size={26} />
                      )}
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.seatName,
                        { color: c.popped ? paper.textSecondary : paper.text },
                        (isWinner || c.id === meId) && styles.seatNameStrong,
                      ]}>
                      {c.id === meId ? t('common.you') : c.name}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[styles.seatNote, { color: isWinner ? paper.accentText : paper.textTertiary }]}>
                      {note}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Animated.View>

          {rounds.length > 0 ? (
            <Animated.View entering={reduced ? undefined : statIn(section++)} style={styles.section}>
              <Text style={[styles.label, { color: paper.textSecondary }]}>{t('match.recapHowItWent')}</Text>
              {rounds.map((round, i) => (
                <View
                  key={round.number}
                  style={[
                    styles.round,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: paper.borderStrong },
                  ]}>
                  <Text style={[styles.roundNumber, { color: paper.textTertiary }]}>{round.number}</Text>
                  <View style={styles.roundBody}>
                    {round.question ? (
                      <Text style={[styles.roundQuestion, { color: paper.text }]} numberOfLines={3}>
                        {`“${round.question}”`}
                      </Text>
                    ) : null}
                    {round.popped.length > 0 ? (
                      <Text style={[styles.roundPopped, { color: round.gotMe ? paper.accentText : paper.textSecondary }]}>
                        {round.gotMe
                          ? t('match.recapGotYou')
                          : t('match.recapPopped', { names: round.popped.join(', ') })}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </Animated.View>
          ) : null}

          {survived !== null || lastAnswer ? (
            <Animated.View
              entering={reduced ? undefined : statIn(section++)}
              style={[styles.footer, { borderTopColor: paper.borderStrong }]}>
              {survived !== null ? (
                <View style={styles.stat}>
                  <Text style={[styles.statLabel, { color: paper.textSecondary }]}>{t('match.recapSurvived')}</Text>
                  <Text style={[styles.statNumber, { color: paper.text }]}>
                    {t('match.recapOf', { count: survived, total: room.totalRounds })}
                  </Text>
                </View>
              ) : null}
              {lastAnswer ? (
                <View style={styles.answer}>
                  <Text style={[styles.statLabel, { color: paper.textSecondary }]}>{t('match.recapLastAnswer')}</Text>
                  <Text style={[styles.answerText, { color: paper.text }]} numberOfLines={3}>
                    {`“${lastAnswer}”`}
                  </Text>
                </View>
              ) : null}
            </Animated.View>
          ) : null}
        </Animated.View>
      </View>
    </Screen>
  );
}

/** A soft band of light that crosses the card every 6 s. Off under Reduce Motion. */
function Sheen({ reduced }: { reduced: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      cancelAnimation(t);
      return;
    }
    t.set(withRepeat(withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }), -1, true));
  }, [reduced, t]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -72 + t.get() * 460 }, { rotate: '12deg' }],
  }));
  if (reduced) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.sheen, style]}>
      <Svg width={60} height={SHEEN_HEIGHT}>
        <Defs>
          <LinearGradient id={`sheen${id}`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset={0} stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset={0.5} stopColor="#FFFFFF" stopOpacity={0.45} />
            <Stop offset={1} stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width={60} height={SHEEN_HEIGHT} fill={`url(#sheen${id})`} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredText: {
    textAlign: 'center',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  content: {
    flexGrow: 1,
  },
  stage: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space.lg,
  },
  card: {
    alignSelf: 'center',
    borderRadius: CARD.radius,
    borderCurve: 'continuous',
    overflow: 'hidden',
    padding: CARD.padding,
  },
  sheen: {
    position: 'absolute',
    top: -200,
    left: 0,
    width: 60,
    height: SHEEN_HEIGHT,
  },
  meta: {
    marginTop: 4,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  headline: {
    marginTop: Space.xl,
    gap: 6,
  },
  label: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 600,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  hero: {
    fontFamily: Fonts.serif,
    fontWeight: 500,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -0.76,
  },
  section: {
    marginTop: Space.lg,
    gap: Space.xs,
  },
  seats: {
    flexDirection: 'row',
    marginTop: 4,
  },
  seat: {
    alignItems: 'center',
    gap: 2,
  },
  seatBalloon: {
    height: 44,
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  seatName: {
    maxWidth: '100%',
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 17,
  },
  seatNameStrong: {
    fontWeight: 600,
  },
  seatNote: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 600,
  },
  round: {
    flexDirection: 'row',
    gap: Space.sm,
    paddingVertical: 10,
  },
  roundNumber: {
    width: 14,
    fontFamily: Fonts.serif,
    fontSize: 17,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
  roundBody: {
    flex: 1,
    gap: 2,
  },
  roundQuestion: {
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
    fontSize: 16,
    lineHeight: 22,
  },
  roundPopped: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 600,
  },
  footer: {
    marginTop: Space.sm,
    paddingTop: Space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Space.sm,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Space.sm,
  },
  statLabel: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  statNumber: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 28,
    fontVariant: ['tabular-nums'],
  },
  answer: {
    gap: 2,
  },
  answerText: {
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
    fontSize: 16,
    lineHeight: 22,
  },
});
