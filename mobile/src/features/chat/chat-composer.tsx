import { useRef } from 'react';
import { AccessibilityInfo, ActivityIndicator, Platform, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { MAX_MESSAGE_LENGTH } from '@/shared/limits';

/** Show how much room is left once the message gets close to the limit. */
const COUNTER_FROM = 900;
/** VoiceOver hears the count as it drops past these, not on every keystroke. */
const SPOKEN_COUNTS = [0, 10, 20, MAX_MESSAGE_LENGTH - COUNTER_FROM];
/** One line of message: a 48 pt pill. The field grows from here as the message wraps. */
const FIELD_HEIGHT = 48;
/** About four lines, then the field scrolls. */
const FIELD_MAX_HEIGHT = 120;
/** The send button sits inside the pill, 6 pt from its right end. */
const SEND_SIZE = 36;

type ChatComposerProps = {
  /** The draft lives in the chat's footer, so a failed send keeps it. */
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending: boolean;
  /** Their name, for the placeholder. */
  name: string;
  /** The message you are answering, shown over the field until you send or cancel. */
  replyingTo?: { label: string; text: string } | null;
  onCancelReply?: () => void;
  /** Starts a voice message. The button for it shows while the field is empty. */
  onRecord?: () => void;
};

/** The message field: a pill on surface 1 with a strong hairline, and the send button inside it. */
export function ChatComposer({
  value: text,
  onChangeText,
  onSend,
  sending,
  name,
  replyingTo = null,
  onCancelReply,
  onRecord,
}: ChatComposerProps) {
  const t = useT();
  const theme = useTheme();
  /** The last count VoiceOver heard, so each step down is said once. */
  const spokenCount = useRef<number | null>(null);
  const canSend = text.trim().length > 0 && !sending;
  /** Nothing typed: the button records a voice message instead. */
  const records = !!onRecord && text.trim().length === 0 && !sending;
  const left = MAX_MESSAGE_LENGTH - text.length;
  const countLabel =
    left === 0 ? t('chat.noCharactersLeft') : t('chat.charactersLeft', { count: left });

  function changeText(next: string) {
    onChangeText(next);
    // The counter's live region speaks on Android and the web; iOS needs an announcement.
    const nextLeft = MAX_MESSAGE_LENGTH - next.length;
    const reached = SPOKEN_COUNTS.find((count) => nextLeft <= count) ?? null;
    if (
      Platform.OS === 'ios' &&
      reached !== null &&
      (spokenCount.current === null || reached < spokenCount.current)
    ) {
      AccessibilityInfo.announceForAccessibilityWithOptions(
        nextLeft === 0 ? t('chat.noCharactersLeft') : t('chat.charactersLeft', { count: nextLeft }),
        { queue: true },
      );
    }
    spokenCount.current = reached;
  }

  return (
    <View style={styles.composer}>
      {replyingTo ? (
        <View style={[styles.replying, { borderLeftColor: theme.text }]}>
          <View style={styles.replyingText}>
            <ThemedText type="captionStrong" numberOfLines={1}>
              {replyingTo.label}
            </ThemedText>
            <ThemedText type="callout" themeColor="textSecondary" numberOfLines={1}>
              {replyingTo.text}
            </ThemedText>
          </View>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('chat.cancelReply')}
            onPress={onCancelReply}
            hitSlop={Space.xs}
            style={[styles.cancelReply, { backgroundColor: theme.surface }]}>
            <Icon name="close" size={11} color={theme.text} />
          </PressableScale>
        </View>
      ) : null}
      <View
        style={[
          styles.pill,
          { backgroundColor: theme.field, boxShadow: `inset 0 0 0 1px ${theme.borderStrong}` },
        ]}>
        <TextInput
          accessibilityLabel={t('chat.messageLabel')}
          placeholder={t('chat.placeholder', { name })}
          placeholderTextColor={theme.textSecondary}
          keyboardAppearance="light"
          selectionColor={theme.text}
          // Read when the field gets focus, once the count shows.
          accessibilityHint={text.length >= COUNTER_FROM ? countLabel : undefined}
          value={text}
          onChangeText={changeText}
          maxLength={MAX_MESSAGE_LENGTH}
          multiline
          // A web textarea opens two rows tall; start at one.
          rows={Platform.OS === 'web' ? 1 : undefined}
          autoCapitalize="sentences"
          // The pill's edge frames the field; drop the browser's outline around the text area.
          style={[styles.input, Platform.OS === 'web' && styles.noOutline, { color: theme.text }]}
        />
        {/* Always in the text color; it only answers once there is something to send. */}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={records ? t('chat.recordVoice') : t('chat.send')}
          accessibilityState={{ disabled: !canSend && !records, busy: sending }}
          disabled={!canSend && !records}
          onPress={records ? onRecord : onSend}
          hitSlop={Space.xxs}
          containerStyle={styles.sendSlot}
          style={[styles.send, { backgroundColor: theme.inverse }]}>
          {sending ? (
            <ActivityIndicator color={theme.onInverse} />
          ) : (
            <Icon name={records ? 'mic' : 'send'} size={16} color={theme.onInverse} />
          )}
        </PressableScale>
      </View>
      {text.length >= COUNTER_FROM ? (
        <ThemedText type="callout" themeColor="textSecondary" accessibilityLiveRegion="polite">
          {countLabel}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    gap: Space.xxs,
  },
  // What you are answering: a bar on the left, their line, and a way out.
  replying: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    marginBottom: Space.xxs,
    paddingLeft: 10,
    borderLeftWidth: 2.5,
  },
  replyingText: {
    flex: 1,
    gap: 1,
  },
  cancelReply: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: FIELD_HEIGHT,
    borderRadius: FIELD_HEIGHT / 2,
    borderCurve: 'continuous',
    paddingLeft: Space.md,
    paddingRight: 6,
  },
  // 13.5 above and below a 21 pt line fills the 48 pt pill.
  input: {
    flex: 1,
    maxHeight: FIELD_MAX_HEIGHT,
    paddingHorizontal: 0,
    paddingTop: 13.5,
    paddingBottom: 13.5,
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
  noOutline: {
    outlineWidth: 0,
  },
  // Centered on a one-line pill, and stays at the bottom as the field grows.
  sendSlot: {
    marginLeft: Space.xs,
    marginBottom: (FIELD_HEIGHT - SEND_SIZE) / 2,
  },
  send: {
    width: SEND_SIZE,
    height: SEND_SIZE,
    borderRadius: SEND_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
