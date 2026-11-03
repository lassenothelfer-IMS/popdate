import { StyleSheet, View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';

import type { Message } from '@/api';
import { ThemedText } from '@/components/themed-text';
import { Ease, Fonts, Radius, Space } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { webSafeKeyframe } from '@/utils/web-motion';

/** Messages from one sender this close together share a group and one timestamp. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;
/** Bubbles are 18 pt round; the sender's tail corner, and corners where a group joins, are 6. */
const BUBBLE_RADIUS = 18;
const TAIL = 6;
/** Only this many bubbles stagger in on first open; the rest arrive with the last of them. */
const MAX_STAGGER = 7;

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

/** On first open each bubble rises 12 pt and grows from .96, 600 ms, 150 ms after the one before. */
const rises = new Map<number, ReturnType<typeof webSafeKeyframe>>();
function riseIn(index: number) {
  const step = Math.min(index, MAX_STAGGER);
  let entering = rises.get(step);
  if (!entering) {
    entering = webSafeKeyframe(
      new Keyframe({
        0: { opacity: 0, transform: [{ translateY: 12 }, { scale: 0.96 }] },
        100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Ease.rise },
      })
        .duration(600)
        .delay(200 + step * 150),
    );
    rises.set(step, entering);
  }
  return entering;
}

/** The room's last round, laid into the top of the chat: who asked what, and the answer. */
export type SeedEntry = { key: string; mine: boolean; label: string; text: string; question: boolean };
export type Seed = { pill: string; entries: SeedEntry[] };

type MessageListProps = {
  messages: Message[];
  myId: string;
  /** Their name, for each of their bubbles' labels. */
  name: string;
  /** Your comment filter, for their words only. */
  filter: (text: string) => string;
  formatTime: (iso: string) => string;
  /** The room's last question and answer, above the messages. */
  seed: Seed | null;
  /** Ids on screen when the chat opened: only those rise in. */
  firstOpen: ReadonlySet<string> | null;
};

/** Your bubbles on the right in the text color, theirs on the left on surface 1, a time under each group. */
export function MessageList({ messages, myId, name, filter, formatTime, seed, firstOpen }: MessageListProps) {
  const t = useT();
  const theme = useTheme();
  const reduced = useReduceMotion();
  const you = t('common.you');
  const groups = groupMessages(messages, myId);
  // Everything on screen at first open rises in, top to bottom.
  const keys = [
    ...(seed ? ['seed-pill', ...seed.entries.map((entry) => entry.key)] : []),
    ...groups.map((group) => group.key),
  ].filter((key) => firstOpen?.has(key));
  const entering = (key: string) => {
    const index = keys.indexOf(key);
    return reduced || index < 0 ? undefined : riseIn(index);
  };

  function bubbleStyle(mine: boolean, joinsAbove: boolean) {
    return [
      styles.bubble,
      mine
        ? {
            backgroundColor: theme.inverse,
            borderTopRightRadius: joinsAbove ? TAIL : BUBBLE_RADIUS,
            borderBottomRightRadius: TAIL,
          }
        : {
            backgroundColor: theme.field,
            boxShadow: `inset 0 0 0 1px ${theme.border}`,
            borderTopLeftRadius: joinsAbove ? TAIL : BUBBLE_RADIUS,
            borderBottomLeftRadius: TAIL,
          },
    ];
  }

  return (
    <View style={styles.list}>
      {seed ? (
        <>
          <Animated.View entering={entering('seed-pill')} style={styles.pillRow}>
            <View style={[styles.pill, { backgroundColor: theme.field, boxShadow: `inset 0 0 0 1px ${theme.border}` }]}>
              <ThemedText type="caption" themeColor="textSecondary">
                {seed.pill}
              </ThemedText>
            </View>
          </Animated.View>
          {seed.entries.map((entry) => (
            <Animated.View
              key={entry.key}
              entering={entering(entry.key)}
              accessible
              accessibilityLabel={`${entry.label}: ${entry.text}`}
              style={[styles.group, entry.mine ? styles.mine : styles.theirs]}>
              <ThemedText type="caption" themeColor="textTertiary" style={styles.seedLabel}>
                {entry.label}
              </ThemedText>
              <View style={bubbleStyle(entry.mine, false)}>
                <ThemedText
                  themeColor={entry.mine ? 'onInverse' : 'text'}
                  style={[styles.text, entry.question && styles.serif]}>
                  {entry.mine ? entry.text : filter(entry.text)}
                </ThemedText>
              </View>
            </Animated.View>
          ))}
        </>
      ) : null}
      {groups.map((group) => {
        const lastSent = group.messages.at(-1)?.sentAt ?? group.messages[0].sentAt;
        return (
          <Animated.View
            key={group.key}
            entering={entering(group.key)}
            style={[styles.group, group.mine ? styles.mine : styles.theirs]}>
            {group.messages.map((message, index) => {
              const text = group.mine ? message.text : filter(message.text);
              return (
                <View
                  key={message.id}
                  accessible
                  accessibilityLabel={t('chat.bubble', {
                    name: group.mine ? you : name,
                    text,
                    time: formatTime(message.sentAt),
                  })}
                  style={bubbleStyle(group.mine, index > 0)}>
                  <ThemedText themeColor={group.mine ? 'onInverse' : 'text'} selectable style={styles.text}>
                    {text}
                  </ThemedText>
                </View>
              );
            })}
            {/* Each bubble already says its time to screen readers. */}
            <ThemedText
              type="caption"
              themeColor="textTertiary"
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={styles.time}>
              {formatTime(lastSent)}
            </ThemedText>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  pillRow: {
    alignItems: 'center',
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: Space.sm,
    borderRadius: Radius.pill,
  },
  group: {
    gap: 2,
    maxWidth: 290,
  },
  mine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  theirs: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  seedLabel: {
    fontSize: 11,
    lineHeight: 14,
    paddingHorizontal: Space.xxs,
    marginBottom: 2,
  },
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: BUBBLE_RADIUS,
    borderCurve: 'continuous',
  },
  /** Chat bubbles: 16/21. */
  text: {
    fontSize: 16,
    lineHeight: 21,
  },
  /** The question asked in the room keeps its New York voice. */
  serif: {
    fontFamily: Fonts.serif,
  },
  time: {
    marginTop: Space.xxs,
    paddingHorizontal: Space.xxs,
  },
});
