import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';

type PromptProps = {
  question: string;
  /** What was said. Left out, the question stands alone. */
  answer?: string | null;
  /** `large` where it has the page to itself, `small` in a list of several. */
  size?: 'small' | 'regular' | 'large';
  style?: StyleProp<ViewStyle>;
};

const ANSWER = {
  small: { fontSize: 20, lineHeight: 25 },
  regular: { fontSize: 26, lineHeight: 31 },
  large: { fontSize: 32, lineHeight: 37 },
} as const;

/**
 * A question and its answer, everywhere in the app. Both are in the text
 * color: what tells them apart is size and typeface, and by a lot. The question
 * is small and in the system font; the answer is large and in the serif.
 */
export function Prompt({ question, answer, size = 'regular', style }: PromptProps) {
  return (
    <View style={[styles.prompt, style]}>
      <ThemedText style={styles.question}>{question}</ThemedText>
      {answer ? <ThemedText style={[styles.answer, ANSWER[size]]}>{answer}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: {
    gap: 8,
  },
  question: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: 600,
  },
  answer: {
    fontFamily: Fonts.serif,
    fontWeight: 400,
    letterSpacing: -0.3,
  },
});
