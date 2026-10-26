import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Balloon } from '@/components/balloon';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { BrandBalloon, Fonts } from '@/constants/theme';
import { seatAt, useSeats, useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/**
 * The three "How it works" cards (design S02 to S04), drawn with the room's own
 * pieces. Shared by onboarding and How to play. All decorative: the title and
 * body under each card carry the meaning.
 */

/** The sample room's holders, in seat order. The fifth is you. */
const HOLDERS = ['Elias', 'Nico', 'Noah', 'Ben'] as const;

/** A 380 pt card on surface 1 with a hairline, the stage for one picture. */
function ArtCard({ children, padded }: { children: ReactNode; padded?: boolean }) {
  const theme = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.card,
        padded && styles.padded,
        { backgroundColor: theme.field, borderColor: theme.border },
      ]}>
      {children}
    </View>
  );
}

/** S02: Mia is choosing tonight, over the five balloons, yours ringed. */
export function RoomArt() {
  const theme = useTheme();
  const seats = useSeats();
  const t = useT();
  return (
    <ArtCard>
      <ThemedText type="kicker" style={styles.roomKicker}>
        {t('onboarding.roomsKicker')}
      </ThemedText>
      <View style={[styles.chooser, { backgroundColor: theme.accentWash }]}>
        <Text style={[styles.chooserInitial, { color: theme.accentText }]}>M</Text>
      </View>
      <View style={styles.chooserText}>
        <ThemedText type="task">{t('onboarding.roomsChooser')}</ThemedText>
        <ThemedText type="callout" themeColor="textSecondary" style={styles.small}>
          {t('onboarding.roomsChoosing')}
        </ThemedText>
      </View>
      <View style={[styles.roomRule, { backgroundColor: theme.border }]} />
      <View style={styles.roomSeats}>
        {HOLDERS.map((name, i) => (
          <View key={name} style={styles.roomSeat}>
            <Balloon color={seatAt(seats, i).color} size={26} string={false} />
            <ThemedText type="railName">{name}</ThemedText>
          </View>
        ))}
        <View style={styles.roomSeat}>
          {/* You: a ring in your balloon's color, with the card's own color between. */}
          <View
            style={[
              styles.ring,
              { boxShadow: `0 0 0 2px ${theme.field}, 0 0 0 4px ${BrandBalloon.color}` },
            ]}>
            <Balloon color={BrandBalloon.color} size={26} string={false} />
          </View>
          <ThemedText type="captionStrong">{t('common.you')}</ThemedText>
        </View>
      </View>
      <ThemedText type="quoteLong" themeColor="textSecondary" style={styles.roomQuote}>
        {t('onboarding.roomsQuote')}
      </ThemedText>
    </ArtCard>
  );
}

/** S03: round 1's question and the first answers, with photos still locked. */
export function RoundsArt() {
  const theme = useTheme();
  const seats = useSeats();
  const t = useT();
  const answers = [
    { name: 'Elias', text: t('onboarding.roundsAnswer1'), seat: 0 },
    { name: 'Nico', text: t('onboarding.roundsAnswer2'), seat: 1 },
  ];
  return (
    <ArtCard padded>
      <ThemedText type="kicker">{t('howToPlay.roundOf', { round: 1, total: 4 })}</ThemedText>
      <ThemedText style={[styles.sampleQuestion, { fontFamily: Fonts.serif }]}>
        {t('onboarding.roundsQuestion')}
      </ThemedText>
      <View style={styles.answers}>
        {answers.map((answer) => (
          <View key={answer.name} style={styles.answer}>
            <View style={styles.answerBalloon}>
              <Balloon color={seatAt(seats, answer.seat).color} size={10} string={false} />
            </View>
            <ThemedText type="callout" style={styles.flex}>
              <Text style={styles.bold}>{answer.name}</Text>
              {'  '}
              {answer.text}
            </ThemedText>
          </View>
        ))}
        <View style={styles.answer}>
          <View style={styles.answerBalloon}>
            <Balloon color={BrandBalloon.color} size={10} string={false} />
          </View>
          <ThemedText type="callout" style={styles.flex}>
            <Text style={styles.bold}>{t('common.you')}</Text>
            {'  '}
            <Text style={{ color: theme.textTertiary }}>{t('onboarding.roundsTyping')}</Text>
          </ThemedText>
        </View>
      </View>
      <View style={[styles.note, { backgroundColor: theme.accentWash }]}>
        <Icon name="lock" size={14} color={theme.accentText} />
        <ThemedText type="callout" themeColor="accentText" style={[styles.flex, styles.noteText]}>
          {t('onboarding.roundsNote')}
        </ThemedText>
      </View>
    </ArtCard>
  );
}

/** Four popped balloons that went soft, and the one left over: "Mia chose you." */
export function LastArt() {
  const theme = useTheme();
  const seats = useSeats();
  const t = useT();
  const deflated = [-20, 12, -8, 22];
  return (
    <ArtCard>
      <ThemedText type="kicker" style={styles.roomKicker}>
        {t('onboarding.lastKicker')}
      </ThemedText>
      <View style={styles.deflated}>
        {deflated.map((angle, i) => (
          <View key={angle} style={{ opacity: 0.22, transform: [{ scaleY: 0.45 }, { rotate: `${angle}deg` }] }}>
            <Balloon color={seatAt(seats, i).color} size={22} string={false} />
          </View>
        ))}
      </View>
      <View style={styles.lastBalloon}>
        <Balloon color={BrandBalloon.color} size={120} string={false} />
      </View>
      <View style={[styles.lastString, { backgroundColor: theme.text }]} />
      <ThemedText style={[styles.lastLine, { fontFamily: Fonts.serif }]}>
        {t('onboarding.lastLine')}
      </ThemedText>
      <ThemedText type="callout" themeColor="textSecondary" style={[styles.small, styles.lastMeta]}>
        {t('onboarding.lastMeta')}
      </ThemedText>
    </ArtCard>
  );
}

/** The three cards with their titles and bodies, in order. */
export const INTRO = [
  { key: 'rooms', Art: RoomArt, title: 'onboarding.roomsTitle', body: 'onboarding.roomsBody' },
  { key: 'rounds', Art: RoundsArt, title: 'onboarding.roundsTitle', body: 'onboarding.roundsBody' },
  { key: 'last', Art: LastArt, title: 'onboarding.lastTitle', body: 'onboarding.lastBody' },
] as const;

const styles = StyleSheet.create({
  card: {
    height: 380,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
  },
  padded: {
    padding: 24,
    gap: 14,
  },
  roomKicker: {
    position: 'absolute',
    left: 24,
    top: 28,
  },
  chooser: {
    position: 'absolute',
    left: 24,
    top: 70,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chooserInitial: {
    fontFamily: Fonts.serif,
    fontSize: 30,
    lineHeight: 34,
  },
  chooserText: {
    position: 'absolute',
    left: 100,
    top: 78,
    gap: 2,
  },
  small: {
    fontSize: 14,
    lineHeight: 19,
  },
  roomRule: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: 164,
    height: 1,
  },
  roomSeats: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: 190,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roomSeat: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  ring: {
    borderRadius: 999,
  },
  roomQuote: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 28,
    fontSize: 17,
    lineHeight: 23,
  },
  sampleQuestion: {
    fontSize: 22,
    lineHeight: 28,
  },
  answers: {
    gap: 10,
    marginTop: 6,
  },
  answer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  answerBalloon: {
    marginTop: 4,
  },
  bold: {
    fontWeight: 600,
  },
  note: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  noteText: {
    fontSize: 14,
    fontWeight: 500,
  },
  deflated: {
    position: 'absolute',
    left: 24,
    top: 70,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
  },
  lastBalloon: {
    position: 'absolute',
    right: 40,
    top: 52,
  },
  lastString: {
    position: 'absolute',
    right: 94,
    top: 200,
    width: 2,
    height: 70,
    transform: [{ rotate: '5deg' }],
    transformOrigin: 'top',
  },
  lastLine: {
    position: 'absolute',
    left: 24,
    bottom: 76,
    fontWeight: 500,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -0.68,
  },
  lastMeta: {
    position: 'absolute',
    left: 24,
    bottom: 28,
  },
  flex: {
    flex: 1,
  },
});
