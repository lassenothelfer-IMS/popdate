import { StyleSheet, View } from 'react-native';

import type { Message } from '@/api';
import { ThemedText } from '@/components/themed-text';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

/** Messages from one sender this close together share a group and one timestamp. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;
/** Where two bubbles of a group meet, on the sender's side, the corner tucks in. */
const TUCKED_CORNER = 6;

type Group = { key: string; mine: boolean; messages: Message[] };

/** Runs of messages from the same sender, split when a pause gets long. */
function groupMessages(messages: Message[], myId: string): Group[] {
  const groups: Group[] = [];
  for (const message of messages) {
    const last = groups.at(-1);
    const previous = last?.messages.at(-1);
    const mine = message.senderId === myId;
    if (
      last &&
      previous &&
      last.mine === mine &&
      Date.parse(message.sentAt) - Date.parse(previous.sentAt) <= GROUP_WINDOW_MS
    ) {
      last.messages.push(message);
    } else {
      groups.push({ key: message.id, mine, messages: [message] });
    }
  }
  return groups;
}

type MessageListProps = {
  messages: Message[];
  myId: string;
  /** Their name, for each of their bubbles' labels. */
  name: string;
  /** Your comment filter, for their words only. */
  filter: (text: string) => string;
  formatTime: (iso: string) => string;
};

/** Your bubbles on the right in ink, theirs on the left in surface, a time under each group. */
export function MessageList({ messages, myId, name, filter, formatTime }: MessageListProps) {
  const t = useT();
  const theme = useTheme();
  const you = t('common.you');

  return (
    <View style={styles.list}>
      {groupMessages(messages, myId).map((group) => {
        const lastSent = group.messages.at(-1)?.sentAt ?? group.messages[0].sentAt;
        return (
          <View key={group.key} style={[styles.group, group.mine ? styles.mine : styles.theirs]}>
            {group.messages.map((message, index) => {
              const text = group.mine ? message.text : filter(message.text);
              const joinsAbove = index > 0;
              const joinsBelow = index < group.messages.length - 1;
              // The sender's side tucks in where two bubbles of a group meet.
              const corners = group.mine
                ? {
                    borderTopRightRadius: joinsAbove ? TUCKED_CORNER : Radius.xl,
                    borderBottomRightRadius: joinsBelow ? TUCKED_CORNER : Radius.xl,
                  }
                : {
                    borderTopLeftRadius: joinsAbove ? TUCKED_CORNER : Radius.xl,
                    borderBottomLeftRadius: joinsBelow ? TUCKED_CORNER : Radius.xl,
                  };
              return (
                <View
                  key={message.id}
                  accessible
                  accessibilityLabel={t('chat.bubble', {
                    name: group.mine ? you : name,
                    text,
                    time: formatTime(message.sentAt),
                  })}
                  style={[
                    styles.bubble,
                    corners,
                    { backgroundColor: group.mine ? theme.inverse : theme.surface },
                  ]}>
                  <ThemedText type="body" themeColor={group.mine ? 'onInverse' : 'text'} selectable>
                    {text}
                  </ThemedText>
                </View>
              );
            })}
            {/* Each bubble already says its time to screen readers. */}
            <ThemedText
              type="footnote"
              themeColor="textSecondary"
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={styles.time}>
              {formatTime(lastSent)}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Space.md,
  },
  group: {
    gap: 2,
  },
  mine: {
    alignItems: 'flex-end',
  },
  theirs: {
    alignItems: 'flex-start',
  },
  // Wide enough for a long line, narrow enough that whose it is reads at a glance.
  bubble: {
    maxWidth: '80%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
  },
  time: {
    marginTop: Space.xxs,
    paddingHorizontal: Space.xxs,
  },
});
