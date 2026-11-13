import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { Question } from '@/api';
import { ThemedText } from '@/components/themed-text';
import { CssEase, Motion, Radius, Space } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

type QuestionPickerProps = {
  options: Question[];
  /** The marked option. A tap only marks it; "Ask this question" commits. */
  selectedId: string | null;
  onSelect: (questionId: string) => void;
  /** True while the pick is on its way: the options lock and the others fade out. */
  locked: boolean;
  /** Balloons still up, who will all answer. */
  answering: number;
};

/** Once one is picked, the others step back; while it is sent, they leave. */
const OTHERS_PICKED = 0.55;

/**
 * The chooser's question options: one card each. A press pushes the card in; the
 * picked one turns black with light text, and the others step back.
 */
export function QuestionPicker({
  options,
  selectedId,
  onSelect,
  locked,
  answering,
}: QuestionPickerProps) {
  const t = useT();

  return (
    <View>
      <ThemedText type="headline" accessibilityRole="header">
        {t('game.askSomething')}
      </ThemedText>

      <View accessibilityRole="radiogroup" style={styles.list}>
        {options.map((question) => (
          <Option
            key={question.id}
            question={question}
            selected={question.id === selectedId}
            anySelected={selectedId !== null}
            locked={locked}
            onSelect={onSelect}
          />
        ))}
      </View>
    </View>
  );
}

type OptionProps = {
  question: Question;
  selected: boolean;
  anySelected: boolean;
  locked: boolean;
  onSelect: (questionId: string) => void;
};

function Option({ question, selected, anySelected, locked, onSelect }: OptionProps) {
  const theme = useTheme();
  const reduced = useReduceMotion();
  const rest = selected || !anySelected ? 1 : locked ? 0 : OTHERS_PICKED;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={question.text}
      accessibilityState={{ checked: selected, disabled: locked }}
      disabled={locked}
      onPress={() => onSelect(question.id)}>
      {({ pressed }) => {
        // Only the card under the finger moves, and it lets go the moment the finger does.
        const down = pressed && !locked;
        return (
          <Animated.View
            style={[
              styles.card,
              {
                // An outline on the page, black once picked; a press dims it, no grey fill.
                backgroundColor: selected ? theme.inverse : theme.page,
                boxShadow: selected ? undefined : `inset 0 0 0 1px ${theme.borderStrong}`,
                opacity: down ? 0.6 : rest,
                transform: [{ scale: reduced ? 1 : down ? 0.97 : selected || !anySelected ? 1 : 0.985 }],
                transitionProperty: ['backgroundColor', 'opacity', 'transform'],
                transitionDuration: down ? Motion.press : Motion.state,
                transitionTimingFunction: CssEase.out,
              },
            ]}>
            <ThemedText
              type="questionRow"
              style={[styles.text, { color: selected ? theme.onInverse : theme.text }]}>
              {question.text}
            </ThemedText>
          </Animated.View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: Space.sm,
    gap: 6,
  },
  /** A question card: New York 19/24 on the card surface, black once picked. */
  card: {
    minHeight: 52,
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: Space.md,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
  },
  text: {
    flexShrink: 1,
  },
});
