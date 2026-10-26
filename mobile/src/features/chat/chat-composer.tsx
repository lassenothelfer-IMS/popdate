import { useRef } from 'react';
import { AccessibilityInfo, ActivityIndicator, Platform, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Fonts, MinTouch, Radius, Space } from '@/constants/theme';
import { useScheme, useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/** The server turns longer messages away. */
export const MAX_MESSAGE_LENGTH = 1000;
/** Show how much room is left once the message gets close to the limit. */
const COUNTER_FROM = 900;
/** VoiceOver hears the count as it drops past these, not on every keystroke. */
const SPOKEN_COUNTS = [0, 10, 20, MAX_MESSAGE_LENGTH - COUNTER_FROM];
/** One line of message. The field grows from here as the message wraps. */
const FIELD_HEIGHT = 52;
/** About four lines, then the field scrolls. */
const FIELD_MAX_HEIGHT = 120;
const SEND_SIZE = MinTouch;

type ChatComposerProps = {
  /** The draft lives in the screen, so a failed send keeps it. */
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending: boolean;
  /** Their name, for the placeholder. */
  name: string;
};

/** The message field and an ink send button side by side, like the room's answer composer. */
export function ChatComposer({ value: text, onChangeText, onSend, sending, name }: ChatComposerProps) {
  const t = useT();
  const theme = useTheme();
  const scheme = useScheme();
  /** The last count VoiceOver heard, so each step down is said once. */
  const spokenCount = useRef<number | null>(null);
  const canSend = text.trim().length > 0 && !sending;
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
      <View style={styles.row}>
        <View
          style={[styles.box, { backgroundColor: theme.field, borderColor: theme.borderStrong }]}>
          <TextInput
            accessibilityLabel={t('chat.messageLabel')}
            placeholder={t('chat.placeholder', { name })}
            placeholderTextColor={theme.textTertiary}
            keyboardAppearance={scheme}
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
            // The box's edge frames the field; drop the browser's outline around the text area.
            style={[styles.input, Platform.OS === 'web' && styles.noOutline, { color: theme.text }]}
          />
        </View>
        {/* Always ink; it only answers once there is something to send. */}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('chat.send')}
          accessibilityState={{ disabled: !canSend, busy: sending }}
          disabled={!canSend}
          onPress={onSend}
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
});
