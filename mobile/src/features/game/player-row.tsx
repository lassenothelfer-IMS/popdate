import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import type { Contestant } from '@/api';
import { PoppedMark } from '@/components/balloon';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Ease, Motion, Space } from '@/constants/theme';
import { YouTag } from '@/features/game/you-tag';
import { useTheme } from '@/hooks/use-theme';
import { useT, type Translate } from '@/i18n';

const ROW_HEIGHT = 56;
/** The column every row's mark sits in: a dot, the answered check or the popped mark. */
const MARK_BOX = 20;
const DOT = 10;
const POPPED_MARK = 14;

/** Small changes inside a row: the Answered check, a row arriving in the Popped group. */
const quietIn = FadeIn.duration(Motion.state).easing(Ease.out).reduceMotion(ReduceMotion.Never);

/** "Lena, 27", with ", you" on your own row. */
function whoLabel(t: Translate, contestant: Contestant, isMe: boolean) {
  const nameAge = t('common.nameAge', { name: contestant.name, age: contestant.age });
  return isMe ? t('game.rowYou', { nameAge }) : nameAge;
}

type LiveRowProps = {
  contestant: Contestant;
  color: string;
  isMe: boolean;
  /** The popper's view while answers come in. Contestants see no statuses. */
  status?: 'answered' | 'writing';
};

/** Someone still in: their dot, name and age, and for the popper whether they answered. */
export function LiveRow({ contestant, color, isMe, status }: LiveRowProps) {
  const theme = useTheme();
  const t = useT();
  const answered = status === 'answered';
  const writing = status === 'writing';
  return (
    <View
      accessible
      accessibilityLabel={[
        whoLabel(t, contestant, isMe),
        answered ? t('game.answered') : writing ? t('game.writing') : null,
      ]
        .filter(Boolean)
        .join('. ')}
      style={[styles.row, { borderBottomColor: theme.border }]}>
      {answered ? (
        <Animated.View
          entering={quietIn}
          style={[styles.check, { backgroundColor: theme.successFill }]}>
          <Icon name="check" size={12} color={theme.onInverse} />
        </Animated.View>
      ) : (
        <View style={styles.markBox}>
          <View style={[styles.dot, { backgroundColor: color }]} />
        </View>
      )}
      <View style={styles.name}>
        {writing ? (
          // Still writing: the whole line steps back.
          <ThemedText type="row" themeColor="textSecondary" style={styles.shrink}>
            {contestant.name}, {contestant.age}
          </ThemedText>
        ) : (
          <ThemedText type="row" style={styles.shrink}>
            {contestant.name},{' '}
            <ThemedText type="row" themeColor="textSecondary" style={styles.age}>
              {contestant.age}
            </ThemedText>
          </ThemedText>
        )}
        {isMe ? <YouTag /> : null}
      </View>
      {answered ? (
        <Animated.View entering={quietIn}>
          <ThemedText type="footnote" themeColor="success">
            {t('game.answered')}
          </ThemedText>
        </Animated.View>
      ) : writing ? (
        <ThemedText type="footnote" themeColor="textTertiary">
          {t('game.writing')}
        </ThemedText>
      ) : null}
    </View>
  );
}

type PoppedRowProps = {
  contestant: Contestant;
  color: string;
  isMe: boolean;
  /** The round it popped in; for a pop still on its way, the round being played. */
  round: number | null;
  /** The last row of the group draws no hairline under it. */
  last: boolean;
};

/** Popped or left: the popped mark in their hue, quiet, and nobody is singled out. */
export function PoppedRow({ contestant, color, isMe, round, last }: PoppedRowProps) {
  const theme = useTheme();
  const t = useT();
  const what = contestant.left
    ? round
      ? t('game.leftInRound', { round })
      : t('game.left')
    : round
      ? t('game.poppedInRound', { round })
      : t('game.popped');
  return (
    <Animated.View
      entering={quietIn}
      accessible
      accessibilityLabel={`${whoLabel(t, contestant, isMe)}. ${what}`}
      style={[styles.row, { borderBottomColor: theme.border }, last && styles.lastRow]}>
      <View style={styles.markBox}>
        <PoppedMark color={color} size={POPPED_MARK} />
      </View>
      <View style={styles.name}>
        <ThemedText type="row" themeColor="textSecondary" style={styles.shrink}>
          {contestant.name}, {contestant.age}
        </ThemedText>
        {isMe ? <YouTag /> : null}
      </View>
      <ThemedText type="footnote" themeColor="textTertiary">
        {what}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: Space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  markBox: {
    width: MARK_BOX,
    height: MARK_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  check: {
    width: MARK_BOX,
    height: MARK_BOX,
    borderRadius: MARK_BOX / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 10,
    rowGap: Space.xxs,
  },
  shrink: {
    flexShrink: 1,
  },
  age: {
    fontWeight: 400,
  },
});
