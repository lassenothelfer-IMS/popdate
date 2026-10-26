import { router } from 'expo-router';
import { useEffect, useId, type ReactNode } from 'react';
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
import { BrandBalloon, Colors, Ease, Fonts, SeatColors, Space } from '@/constants/theme';
import { BackButton } from '@/features/onboarding/back-button';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useRoom } from '@/hooks/use-server';
import { seatAt } from '@/hooks/use-theme';
import { useT, useLocale } from '@/i18n';
import { useSession } from '@/state/session';
import { goHome } from '@/utils/navigation';
import { webSafeKeyframe } from '@/utils/web-motion';

/** The recap card is always drawn in Cream, whatever the app's theme, so it shares the same everywhere. */
const paper = Colors.light;
const paperSeats = SeatColors.light;
/** The card is 320 x 520 on a 390 pt screen. */
const CARD = { width: 320, height: 520, radius: 24 };

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

/** The stats fade up 10 pt, 150 ms apart from 800 ms. */
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
    return (
      <Screen
        scroll
        contentStyle={styles.centered}
        footerStyle="plain"
        footer={<Button title={t('match.backHome')} onPress={goHome} />}>
        <ThemedText themeColor="textSecondary" style={styles.centeredText}>
          {t('match.recapGone')}
        </ThemedText>
      </Screen>
    );
  }
  return <Recap room={room} />;
}

function Recap({ room }: { room: Room }) {
  const t = useT();
  const locale = useLocale();
  const { profile } = useSession();
  const reduced = useReduceMotion();
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(CARD.width, windowWidth - 70);
  const height = (CARD.height / CARD.width) * width;

  const meId = room.me.id;
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
  // The room keeps its last question, so it is the one that got you only if you popped in the last round.
  const gotYou = me?.popped && me.poppedInRound === room.round && room.question ? room.question.text : null;
  const lastAnswer = me?.answer ?? null;

  let dateLine = '';
  try {
    dateLine = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  } catch {
    dateLine = new Date().toDateString();
  }
  if (profile?.city) dateLine = `${profile.city}, ${dateLine}`;

  const stats: { key: string; label: string; value: ReactNode }[] = [];
  if (survived !== null) {
    stats.push({
      key: 'survived',
      label: t('match.recapSurvived'),
      value: (
        <Text style={[styles.statNumber, { color: paper.text }]}>
          {t('match.recapOf', { count: survived, total: room.totalRounds })}
        </Text>
      ),
    });
  }
  if (gotYou) {
    stats.push({
      key: 'gotYou',
      label: t('match.recapGotYou'),
      value: (
        <Text style={[styles.statQuote, { color: paper.text }]} numberOfLines={3}>
          {`“${gotYou}”`}
        </Text>
      ),
    });
  }
  stats.push({
    key: 'room',
    label: t('match.recapRoom'),
    value: (
      <View style={styles.row} accessible accessibilityLabel={t('match.recapRoomLabel', { count: room.contestants.length })}>
        {room.contestants.map((c, i) =>
          c.popped ? (
            <View key={c.id} style={styles.poppedSeat}>
              <PoppedMark color={seatAt(paperSeats, i).color} size={12} />
            </View>
          ) : (
            <Balloon key={c.id} color={seatAt(paperSeats, i).color} size={12} string={false} />
          ),
        )}
      </View>
    ),
  });

  return (
    <Screen
      footerStyle="plain"
      contentStyle={styles.content}
      footer={<Button title={t('match.backHome')} onPress={goHome} />}>
      <BackButton onPress={() => (router.canGoBack() ? router.back() : goHome())} />

      <View style={styles.stage}>
        <Animated.View
          entering={reduced ? undefined : cardIn}
          accessible
          accessibilityLabel={t('match.recapCard')}
          style={[
            styles.card,
            {
              width,
              height,
              backgroundColor: paper.page,
              boxShadow: `0 40px 80px -30px rgba(0,0,0,0.9), inset 0 0 0 1px ${paper.border}`,
            },
          ]}>
          <Sheen height={height} reduced={reduced} />
          <View style={styles.brand}>
            <Text style={[styles.wordmark, { color: paper.text }]}>P</Text>
            <View style={styles.wordmarkBalloon}>
              <Balloon color={BrandBalloon.color} size={8} string={false} shine={false} />
            </View>
            <Text style={[styles.wordmark, { color: paper.text }]}>pdate</Text>
          </View>
          <Text style={[styles.meta, { color: paper.textSecondary }]}>{dateLine}</Text>

          <View style={styles.headline}>
            <Text style={[styles.label, { color: paper.textSecondary }]}>{t('match.recapKicker')}</Text>
            <Text style={[styles.hero, { color: paper.text }]}>{headline}</Text>
          </View>

          <View style={styles.stats}>
            {stats.map((stat, i) => (
              <Animated.View
                key={stat.key}
                entering={reduced ? undefined : statIn(i)}
                style={[
                  styles.stat,
                  i < stats.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: paper.borderStrong },
                ]}>
                <Text style={[styles.statLabel, { color: paper.textSecondary }]}>{stat.label}</Text>
                {stat.value}
              </Animated.View>
            ))}
          </View>

          {lastAnswer ? (
            <View style={styles.answer}>
              <Text style={[styles.answerLabel, { color: paper.textSecondary }]}>{t('match.recapLastAnswer')}</Text>
              <Text style={[styles.answerText, { color: paper.text }]} numberOfLines={2}>
                {`“${lastAnswer}”`}
              </Text>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Screen>
  );
}

/** A soft band of light that crosses the card every 6 s. Off under Reduce Motion. */
function Sheen({ height, reduced }: { height: number; reduced: boolean }) {
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
    <Animated.View pointerEvents="none" style={[styles.sheen, { height: height + 80 }, style]}>
      <Svg width={60} height={height + 80}>
        <Defs>
          <LinearGradient id={`sheen${id}`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset={0} stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset={0.5} stopColor="#FFFFFF" stopOpacity={0.45} />
            <Stop offset={1} stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width={60} height={height + 80} fill={`url(#sheen${id})`} />
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
  content: {
    flexGrow: 1,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space.md,
  },
  card: {
    borderRadius: CARD.radius,
    borderCurve: 'continuous',
    overflow: 'hidden',
    padding: 24,
  },
  sheen: {
    position: 'absolute',
    top: -40,
    left: 0,
    width: 60,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  wordmark: {
    fontFamily: Fonts.wordmark,
    fontSize: 16,
    lineHeight: 18,
    letterSpacing: -0.48,
  },
  wordmarkBalloon: {
    marginHorizontal: 0.5,
    marginBottom: -2,
  },
  meta: {
    marginTop: 10,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  headline: {
    marginTop: 64,
    gap: 4,
  },
  label: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 600,
  },
  hero: {
    fontFamily: Fonts.serif,
    fontWeight: 500,
    fontSize: 44,
    lineHeight: 44,
    letterSpacing: -0.88,
  },
  stats: {
    marginTop: 28,
    gap: 10,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.sm,
    paddingBottom: 10,
  },
  statLabel: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  statNumber: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
  },
  statQuote: {
    flexShrink: 1,
    maxWidth: 150,
    textAlign: 'right',
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  poppedSeat: {
    opacity: 0.3,
  },
  answer: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 22,
    gap: 2,
  },
  answerLabel: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 600,
  },
  answerText: {
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 20,
  },
});
