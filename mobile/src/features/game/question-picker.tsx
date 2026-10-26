import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { Question } from '@/api';
import { Icon } from '@/components/icon';
import { PressableHighlight } from '@/components/pressable-highlight';
import { ThemedText } from '@/components/themed-text';
import { CssEase, Motion, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

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

/** The chooser's question options: New York rows over hairlines, the picked one checked. */
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
                background="transparent"
                style={[styles.option, { borderBottomColor: theme.border }]}>
                <ThemedText type="questionRow" style={styles.text}>
                  {question.text}
                </ThemedText>
                {/* The picked one gets a filled check; it always has its place, so text never moves. */}
                <Animated.View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[
                    styles.check,
                    {
                      backgroundColor: theme.inverse,
                      opacity: selected ? 1 : 0,
                      transitionProperty: 'opacity',
                      transitionDuration: Motion.state,
                      transitionTimingFunction: CssEase.out,
                    },
                  ]}>
                  <Icon name="check" size={11} color={theme.onInverse} />
                </Animated.View>
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
  },
  /** A question row: New York 19/24, a hairline under it, the check on the right. */
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: {
    flex: 1,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
