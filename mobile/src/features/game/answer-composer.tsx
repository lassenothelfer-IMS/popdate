import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Ease, Fonts, MinTouch, Motion, Radius, Space } from '@/constants/theme';
import { announce } from '@/features/game/announce';
import { useScheme, useTheme } from '@/hooks/use-theme';
import { useT, type Translate } from '@/i18n';

const MAX_ANSWER_LENGTH = 280;
/** Show how much room is left once the answer gets close to the limit. */
const COUNTER_FROM = 240;
/** VoiceOver hears the count as it drops past these, not on every keystroke. */
const SPOKEN_COUNTS = [0, 10, 20, MAX_ANSWER_LENGTH - COUNTER_FROM];
/** One line of answer. The field grows from here as the answer wraps. */
const FIELD_HEIGHT = 52;
/** About four lines, then the field scrolls. */
const FIELD_MAX_HEIGHT = 120;
const SEND_SIZE = MinTouch;
/** Short answers are set big, like a prompt card; longer ones in the long-quote size. */
const SHORT_ANSWER = 90;

const sentIn = FadeIn.duration(Motion.state).easing(Ease.out).reduceMotion(ReduceMotion.Never);

/** The count as VoiceOver says it. */
function countLeft(t: Translate, left: number) {
  if (left === 0) return t('game.noCharactersLeft');
  return t('game.charactersLeft', { count: left });
}

type AnswerComposerProps = {
  /** The draft lives in the room, so it survives the leave flow. */
  value: string;
  onChangeText: (text: string) => void;
  /** Resolves once the server has the answer. */
  onSend: (text: string) => Promise<void>;
  onFocus?: () => void;
  popperName: string;
};

/** The answer field and an ink send button, side by side in the footer bar. */
export function AnswerComposer({
  value: text,
  onChangeText,
  onSend,
  onFocus,
  popperName,
}: AnswerComposerProps) {
  const theme = useTheme();
  const scheme = useScheme();
  const t = useT();
  const [sending, setSending] = useState(false);
  /** The last count VoiceOver heard, so each step down is said once. */
  const spokenCount = useRef<number | null>(null);
  const canSend = text.trim().length > 0 && !sending;
  const left = MAX_ANSWER_LENGTH - text.length;

  function changeText(next: string) {
    onChangeText(next);
    // The counter's live region speaks on Android and the web; iOS ignores it.
    const nextLeft = MAX_ANSWER_LENGTH - next.length;
    const reached = SPOKEN_COUNTS.find((count) => nextLeft <= count) ?? null;
    if (reached !== null && (spokenCount.current === null || reached < spokenCount.current)) {
      announce(countLeft(t, nextLeft));
    }
    spokenCount.current = reached;
  }

  async function handleSend() {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await onSend(text);
      // On success the room swaps this composer for the Sent line.
    } catch {
      // The room shows the error above the composer.
      setSending(false);
    }
  }

  return (
    <View style={styles.composer}>
      <View style={styles.row}>
        <View
          style={[styles.box, { backgroundColor: theme.field, borderColor: theme.borderStrong }]}>
          <TextInput
            accessibilityLabel={t('game.yourAnswer')}
            placeholder={t('game.answerPlaceholder', { name: popperName })}
            placeholderTextColor={theme.textTertiary}
            keyboardAppearance={scheme}
            selectionColor={theme.text}
            // Read when the field gets focus, once the count shows.
            accessibilityHint={text.length >= COUNTER_FROM ? countLeft(t, left) : undefined}
            value={text}
            onChangeText={changeText}
            onFocus={onFocus}
            maxLength={MAX_ANSWER_LENGTH}
            multiline
            // A web textarea opens two rows tall; start at one, like the field on the canvas.
            rows={Platform.OS === 'web' ? 1 : undefined}
            editable={!sending}
            // The box's edge frames the field; drop the browser's outline around the text area.
            style={[styles.input, Platform.OS === 'web' && styles.noOutline, { color: theme.text }]}
          />
        </View>
        {/* Always ink, as on the canvas; it only answers once there is something to send. */}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('game.sendAnswer')}
          accessibilityState={{ disabled: !canSend, busy: sending }}
          disabled={!canSend}
          onPress={handleSend}
          hitSlop={Space.xxs}
          containerStyle={styles.sendSlot}
          style={[styles.send, { backgroundColor: theme.inverse }]}>
          {sending ? (
            <ActivityIndicator color={theme.onInverse} />
          ) : (
            <Icon name="send" size={18} color={theme.onInverse} />
          )}
        </PressableScale>
      </View>
      {text.length >= COUNTER_FROM ? (
        <ThemedText type="footnote" themeColor="textSecondary" accessibilityLiveRegion="polite">
          {t('game.charactersLeft', { count: left })}
        </ThemedText>
      ) : null}
    </View>
  );
}

/**
 * Replaces the composer in the footer once your answer is in. Your words show
 * in full in the page instead, in SentAnswerCard, where they can wrap. Its live
 * region speaks on Android and the web; on iOS the room says it once the send lands.
 */
export function AnswerSent({ popperName }: { popperName: string }) {
  const theme = useTheme();
  const t = useT();
  const sent = t('game.sent', { name: popperName });
  return (
    <Animated.View
      entering={sentIn}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={sent}
      style={styles.sent}>
      <Icon name="checkCircle" size={16} color={theme.success} />
      <ThemedText type="label" themeColor="success" style={styles.sentText}>
        {sent}
      </ThemedText>
    </Animated.View>
  );
}

/** Your sent answer, under the question it answers. */
export function SentAnswerCard({ text }: { text: string }) {
  const theme = useTheme();
  const t = useT();
  return (
    <Animated.View
      entering={sentIn}
      accessible
      accessibilityLabel={t('game.yourAnswerLabel', { text })}
      style={[styles.card, { backgroundColor: theme.field, borderColor: theme.outline }]}>
      <ThemedText type="footnote" themeColor="textSecondary">
        {t('game.yourAnswer')}
      </ThemedText>
      <ThemedText type={text.length <= SHORT_ANSWER ? 'quote' : 'quoteLong'}>
        {`“${text}”`}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  composer: {
    gap: Space.xxs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Space.xs,
  },
  box: {
    flex: 1,
    justifyContent: 'center',
    minHeight: FIELD_HEIGHT,
    borderWidth: 1,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: Space.md,
  },
  // 14 above and below a 22pt line fills the 52pt field inside its 1pt edge.
  input: {
    maxHeight: FIELD_MAX_HEIGHT,
    paddingHorizontal: 0,
    paddingTop: 14,
    paddingBottom: 14,
    fontFamily: Fonts.sans,
    fontSize: 17,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  noOutline: {
    outlineWidth: 0,
  },
  // Centered on a one-line field, and stays at the bottom as the field grows.
  sendSlot: {
    marginBottom: (FIELD_HEIGHT - SEND_SIZE) / 2,
  },
  send: {
    width: SEND_SIZE,
    height: SEND_SIZE,
    borderRadius: SEND_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sent: {
    minHeight: MinTouch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sentText: {
    flexShrink: 1,
    textAlign: 'center',
  },
  card: {
    gap: Space.xxs,
    paddingVertical: 14,
    paddingHorizontal: Space.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
  },
});
