import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated from 'react-native-reanimated';

import type { Room } from '@/api';
import { Space } from '@/constants/theme';
import { SentAnswerCard } from '@/features/game/answer-composer';
import { CANVAS_SPACING, TIGHT_SPACING } from '@/features/game/reveal-layout';
import { QuestionBlock } from '@/features/game/room-blocks';
import { questionIn } from '@/features/game/room-motion';
import type { RoomPhase } from '@/features/game/room-phase';
import { RoomStatusLine } from '@/features/game/room-status-line';
import { ThemedText } from '@/components/themed-text';
import { useT } from '@/i18n';

type QuestionSectionProps = {
  room: Room;
  phase: RoomPhase;
  showHints: boolean;
  tight: boolean;
  /** "Your photo 3 is showing.", for the line under the question. */
  myPhotoLine: string;
  onQuestionLayout: (event: LayoutChangeEvent) => void;
};

/**
 * The answering and popping phases' top: the question, your sent answer, and what
 * the room is waiting on under them.
 */
export function QuestionSection({
  room,
  phase,
  showHints,
  tight,
  myPhotoLine,
  onQuestionLayout,
}: QuestionSectionProps) {
  const t = useT();
  const { isPopper, myAnswer, statusLine } = phase;
  return (
    <>
      {phase.showQuestionBlock && room.question ? (
        <View style={tight ? styles.questionTight : styles.question} onLayout={onQuestionLayout}>
          <Animated.View entering={questionIn}>
            <QuestionBlock
              kicker={isPopper ? undefined : t('game.asks', { name: room.popper.name })}
              text={room.question.text}
              size={phase.finalTwo ? 'final' : phase.answering ? 'round' : 'waiting'}
            />
          </Animated.View>
        </View>
      ) : null}

      {/* The chooser waits for answers: how many are in, at a size you can read from across the table. */}
      {isPopper && phase.answering ? (
        <ThemedText type="display" style={styles.count}>
          {t('game.answeredCount', {
            count: phase.up.filter((contestant) => contestant.answered).length,
            total: phase.up.length,
          })}
        </ThemedText>
      ) : null}

      {myAnswer ? (
        <View style={styles.myAnswer}>
          <SentAnswerCard text={myAnswer} />
        </View>
      ) : null}

      {statusLine ? (
        <RoomStatusLine
          key={statusLine}
          kind={statusLine}
          popperName={room.popper.name}
          popReminder={room.popReminder}
          showHints={showHints}
          upCount={phase.up.length}
          afterAnswer={!!myAnswer}
          tight={tight}
          myPhotoLine={phase.myPhotoShowing ? myPhotoLine : null}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  question: {
    marginTop: CANVAS_SPACING.question,
  },
  questionTight: {
    marginTop: TIGHT_SPACING.question,
  },
  myAnswer: {
    marginTop: Space.lg,
  },
  count: {
    marginTop: Space.lg,
  },
});
