import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { Question } from '@/api';
import { PressableHighlight } from '@/components/pressable-highlight';
import { ThemedText } from '@/components/themed-text';
import { CssEase, Motion, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/** Rows reach this far into the gutter, so their text lines up with the heading. */
const ROW_INSET = Space.sm;

type QuestionPickerProps = {
  options: Question[];
  /** The marked option. A tap only marks it; "Ask this question" commits. */
  selectedId: string | null;
  onSelect: (questionId: string) => void;
  /** True while the pick is on its way: the options lock and the others dim. */
  locked: boolean;
  /** Balloons still up, who will all answer. */
  answering: number;
};

/** The popper's question options: plain rows, the picked one on a red wash with a red edge. */
export function QuestionPicker({
  options,
  selectedId,
  onSelect,
  locked,
  answering,
}: QuestionPickerProps) {
  const theme = useTheme();
  const t = useT();

  return (
    <View>
      <ThemedText type="headline" accessibilityRole="header">
        {t('game.askSomething')}
      </ThemedText>
      <ThemedText type="footnote" themeColor="textSecondary" style={styles.hint}>
        {answering === 2
          ? t('game.pickHintBoth')
          : t('game.pickHintAll', { count: answering })}
      </ThemedText>

      <View accessibilityRole="radiogroup" style={styles.list}>
        {options.map((question) => {
          const selected = question.id === selectedId;
          return (
            <Animated.View
              key={question.id}
              style={{
                opacity: locked && !selected ? 0.5 : 1,
                transitionProperty: 'opacity',
                transitionDuration: Motion.state,
                transitionTimingFunction: CssEase.out,
              }}>
              <PressableHighlight
                accessibilityRole="radio"
                accessibilityLabel={question.text}
                accessibilityState={{ checked: selected, disabled: locked }}
                disabled={locked}
                onPress={() => onSelect(question.id)}
                background={selected ? theme.accentWash : theme.page}
                style={styles.option}>
                <ThemedText style={styles.text}>{question.text}</ThemedText>
                {/* Drawn over the row, so picking one never moves its text. */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.edge,
                    {
                      borderColor: theme.accentText,
                      opacity: selected ? 1 : 0,
                      transitionProperty: 'opacity',
                      transitionDuration: Motion.state,
                      transitionTimingFunction: CssEase.out,
                    },
                  ]}
                />
              </PressableHighlight>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    marginTop: 2,
  },
  list: {
    marginTop: Space.sm,
    marginHorizontal: -ROW_INSET,
    gap: 2,
  },
  option: {
    paddingHorizontal: ROW_INSET + 1,
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
  },
  text: {
    fontWeight: 500,
  },
  edge: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
});
