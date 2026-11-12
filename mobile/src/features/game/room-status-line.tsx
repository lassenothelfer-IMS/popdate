import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import { questionIn } from '@/features/game/room-motion';
import type { RoomStatusLine as Kind } from '@/features/game/room-phase';
import { CANVAS_SPACING, TIGHT_SPACING } from '@/features/game/reveal-layout';
import { useT } from '@/i18n';
import { numberWord } from '@/utils/number-word';

type RoomStatusLineProps = {
  kind: Kind;
  popperName: string;
  popReminder: boolean;
  showHints: boolean;
  /** Balloons still up. */
  upCount: number;
  /** Your answer shows above the line. */
  afterAnswer: boolean;
  tight: boolean;
  /** "Your photo 3 is showing.", while it is. */
  myPhotoLine: string | null;
};

/**
 * What the room is waiting on, under the question. Keyed by its kind where it is
 * used, so a new line arrives with the question, after the rows move.
 */
export function RoomStatusLine(props: RoomStatusLineProps) {
  const t = useT();
  const { kind, showHints } = props;
  if (kind === 'answering') {
    // Nothing under the question while answers come in: the ticks on the balloons say it.
    return null;
  }
  if (kind === 'choose') {
    return (
      <Animated.View
        entering={questionIn}
        style={props.tight ? styles.chooseLineTight : styles.chooseLine}>
        <View>
          <ThemedText type="headline" accessibilityRole="header" accessibilityLiveRegion="polite">
            {props.popReminder ? t('game.waitingOnYou') : t('game.choosePop')}
          </ThemedText>
          {showHints && !props.popReminder && props.upCount > 2 ? (
            <ThemedText type="callout" themeColor="textSecondary">
              {t('game.swipeHint', { people: numberWord(t, props.upCount) })}
            </ThemedText>
          ) : null}
        </View>
      </Animated.View>
    );
  }
  return (
    <Animated.View entering={questionIn} style={styles.afterQuestion}>
      <ThemedText type="callout" themeColor="textSecondary" accessibilityLiveRegion="polite">
        {t('game.isDeciding', { name: props.popperName })}…
        {props.myPhotoLine ? ` ${props.myPhotoLine}` : ''}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  afterQuestion: {
    marginTop: 10,
  },
  afterAnswer: {
    marginTop: Space.sm,
  },
  chooseLine: {
    marginTop: CANVAS_SPACING.choose,
  },
  chooseLineTight: {
    marginTop: TIGHT_SPACING.choose,
  },
});
