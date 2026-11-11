import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  Keyframe,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { Message } from '@/api';
import { Balloon } from '@/components/balloon';
import { ThemedText } from '@/components/themed-text';
import { VoiceMessage } from '@/features/chat/voice-message';
import { Ease, Fonts, Motion, Radius, Space } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { replyHangs, splitLinks, voiceTime, type LinkPreview, type VoiceNote } from '@/shared/chat';
import { webSafeKeyframe } from '@/utils/web-motion';

/** Messages from one sender this close together share a group and one timestamp. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;
/** Bubbles are 18 pt round; the sender's tail corner, and corners where a group joins, are 6. */
const BUBBLE_RADIUS = 18;
const TAIL = 6;
/** Only this many bubbles stagger in on first open; the rest arrive with the last of them. */
const MAX_STAGGER = 7;
/** Two taps this close together on a bubble are a double tap: a heart. */
const DOUBLE_TAP_MS = 280;
/** How far a reply or a reaction climbs onto the corner of the bubble it belongs to. */
const CORNER_OVERLAP = 10;

/** A message you sent that the server hasn't confirmed yet, or that didn't go through. */
export type PendingMessage = {
  localId: string;
  text: string;
  replyTo?: string;
  /** A recording instead of text. */
  voice?: VoiceNote;
  failed: boolean;
  /** The server's id once it went through; the bubble steps aside when that message arrives. */
  sentId?: string;
};

/** Where a bubble is on the screen, for placing the reactions bar over it. */
export type BubbleAnchor = { x: number; y: number; width: number; height: number };

type Group = { key: string; mine: boolean; messages: Message[] };

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/** Runs of messages from the same sender, split when a pause gets long or the day changes. */
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
      Date.parse(message.sentAt) - Date.parse(previous.sentAt) <= GROUP_WINDOW_MS &&
      sameDay(message.sentAt, previous.sentAt)
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

/** A reaction or a reply landing on a bubble's corner: it pops in from a little small. */
const cornerIn = webSafeKeyframe(
  new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0.6 }] },
    100: { opacity: 1, transform: [{ scale: 1 }], easing: Ease.rise },
  }).duration(320),
);
const quietIn = FadeIn.duration(Motion.state).easing(Ease.out).reduceMotion(ReduceMotion.Never);

/** The room's last round, laid into the top of the chat: who asked what, and the answer. */
/** The room's last round, over the messages: whose answer it is, the question, and the answer. */
export type Seed = { kicker: string; question: string; answer: string | null; answerMine: boolean };
/** The seed's key, so the first open knows to rise it in before the room loads. */
export const SEED_KEY = 'seed-card';

type MessageListProps = {
  messages: Message[];
  /** Your messages still on their way, or that didn't go through, after the rest. */
  pending: PendingMessage[];
  myId: string;
  /** Their name, for each of their bubbles' labels. */
  name: string;
  /** Your comment filter, for their words only. */
  filter: (text: string) => string;
  /** "14:02". The day stands on the divider above. */
  formatTime: (iso: string) => string;
  /** "Today", "Yesterday", or the date. */
  formatDay: (iso: string) => string;
  /** The room's last question and answer, above the messages. */
  seed: Seed | null;
  /** Ids on screen when the chat opened: only those rise in. */
  firstOpen: ReadonlySet<string> | null;
  /** They are typing right now. */
  typing: boolean;
  /** A long press on a bubble: the reactions and Reply, over where the bubble is. */
  onOpenActions: (message: Message, anchor: BubbleAnchor) => void;
  /** A double tap on a bubble. */
  onHeart: (message: Message) => void;
  onRetry: (localId: string) => void;
  onOpenLink: (url: string) => void;
};

/**
 * Your bubbles on the right in the text color, theirs on the left on surface 1.
 * A day's first messages sit under its divider, each group has its time, and your
 * newest says whether it was sent. A reply and a reaction hang on the corner of
 * the bubble they belong to.
 */
export function MessageList({
  messages,
  pending,
  myId,
  name,
  filter,
  formatTime,
  formatDay,
  seed,
  firstOpen,
  typing,
  onOpenActions,
  onHeart,
  onRetry,
  onOpenLink,
}: MessageListProps) {
  const t = useT();
  const theme = useTheme();
  const reduced = useReduceMotion();
  const you = t('common.you');
  /** The voice message that is playing. One at a time. */
  const [playing, setPlaying] = useState<string | null>(null);

  // A reply close to the message it answers hangs on that message's corner; the
  // rest of the chat flows on without it.
  const order = messages.map((message) => message.id);
  const byId = new Map(messages.map((message) => [message.id, message]));
  const hanging = new Map<string, Message[]>();
  const flow: Message[] = [];
  for (const message of messages) {
    // A voice message is a bubble of its own, wherever it answers.
    if (message.replyTo && !message.voice && replyHangs(order, message.id, message.replyTo)) {
      // A reply to a reply hangs with it, on the bubble the first one answered.
      let root = message.replyTo;
      for (let target = byId.get(root); target?.replyTo && hanging.get(target.replyTo)?.includes(target); ) {
        root = target.replyTo;
        target = byId.get(root);
      }
      hanging.set(root, [...(hanging.get(root) ?? []), message]);
    } else {
      flow.push(message);
    }
  }
  const groups = groupMessages(flow, myId);
  const waiting = pending.filter((item) => !item.sentId || !byId.has(item.sentId));
  const lastGroup = groups.at(-1);

  // Everything on screen at first open rises in, top to bottom.
  const keys = [
    ...(seed ? [SEED_KEY] : []),
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

  /** The text of a bubble, its links tappable. */
  function body(text: string, mine: boolean) {
    return (
      <ThemedText themeColor={mine ? 'onInverse' : 'text'} style={styles.text}>
        {splitLinks(text).map((part, i) =>
          part.url ? (
            <Text
              key={i}
              accessibilityRole="link"
              onPress={() => onOpenLink(part.url!)}
              style={styles.link}>
              {part.text}
            </Text>
          ) : (
            part.text
          ),
        )}
      </ThemedText>
    );
  }

  return (
    <View style={styles.list}>
      {seed ? (
        <Animated.View
          entering={entering(SEED_KEY)}
          accessible
          accessibilityLabel={[
            seed.kicker,
            seed.question,
            seed.answer ? (seed.answerMine ? seed.answer : filter(seed.answer)) : '',
          ]
            .filter(Boolean)
            .join('. ')}
          style={[
            styles.seed,
            { backgroundColor: theme.field, boxShadow: `inset 0 0 0 1px ${theme.border}` },
          ]}>
          <View style={styles.seedTop}>
            <Balloon color={theme.brandPale} size={9} />
            <ThemedText style={[styles.seedKicker, { color: theme.textTertiary }]}>{seed.kicker}</ThemedText>
          </View>
          <ThemedText type="questionRow" themeColor="textSecondary" style={styles.seedQuestion}>
            {seed.question}
          </ThemedText>
          {seed.answer ? (
            <ThemedText type="quoteLong">{`“${seed.answerMine ? seed.answer : filter(seed.answer)}”`}</ThemedText>
          ) : null}
        </Animated.View>
      ) : null}

      {groups.map((group, groupIndex) => {
        const first = group.messages[0];
        const lastSent = group.messages.at(-1)?.sentAt ?? first.sentAt;
        const before = groups[groupIndex - 1]?.messages[0].sentAt;
        const newDay = before === undefined || !sameDay(before, first.sentAt);
        // Your newest message says it arrived, unless one after it is still on its way.
        const sent = group === lastGroup && group.mine && waiting.length === 0;
        return (
          <View key={group.key} style={styles.dayAndGroup}>
            {newDay ? (
              <Animated.View entering={entering(group.key)} style={styles.pillRow}>
                <ThemedText type="caption" themeColor="textTertiary" accessibilityRole="header">
                  {formatDay(first.sentAt)}
                </ThemedText>
              </Animated.View>
            ) : null}
            <Animated.View
              entering={entering(group.key)}
              style={[styles.group, group.mine ? styles.mine : styles.theirs]}>
              {group.messages.map((message, index) => {
                const text = group.mine ? message.text : filter(message.text);
                const replies = hanging.get(message.id) ?? [];
                const reactions = message.reactions ?? [];
                // A reply too far from what it answers quotes it instead.
                const quoted = message.replyTo ? byId.get(message.replyTo) : undefined;
                return (
                  <View key={message.id} style={group.mine ? styles.mine : styles.theirs}>
                    <Bubble
                      label={[
                        message.voice
                          ? t('chat.voiceLabel', {
                              name: group.mine ? you : name,
                              time: voiceTime(message.voice.durationMs),
                            })
                          : t('chat.bubble', {
                              name: group.mine ? you : name,
                              text,
                              time: formatTime(message.sentAt),
                            }),
                        ...reactions.map((reaction) => reaction.emoji),
                        ...replies.map((reply) =>
                          t('chat.replyLabel', {
                            name: reply.senderId === myId ? you : name,
                            text: reply.senderId === myId ? reply.text : filter(reply.text),
                          }),
                        ),
                      ].join('. ')}
                      hint={t('chat.actionsHint')}
                      style={bubbleStyle(group.mine, index > 0)}
                      onDoubleTap={() => onHeart(message)}
                      onActivate={
                        message.voice
                          ? () => setPlaying(playing === message.id ? null : message.id)
                          : undefined
                      }
                      onOpen={(anchor) => onOpenActions(message, anchor)}>
                      {quoted ? (
                        <ThemedText
                          type="caption"
                          numberOfLines={1}
                          style={[styles.quote, { color: group.mine ? theme.onInverse : theme.textSecondary }]}>
                          {t('chat.quoteLine', {
                            text: quoted.senderId === myId ? quoted.text : filter(quoted.text),
                          })}
                        </ThemedText>
                      ) : null}
                      {message.voice ? (
                        <VoiceMessage
                          voice={message.voice}
                          mine={group.mine}
                          active={playing === message.id}
                          onPlay={() => setPlaying(message.id)}
                          onDone={() => setPlaying(null)}
                        />
                      ) : (
                        body(text, group.mine)
                      )}
                      {message.link ? (
                        <LinkCard link={message.link} mine={group.mine} onOpen={onOpenLink} />
                      ) : null}
                    </Bubble>
                    {reactions.length > 0 || replies.length > 0 ? (
                      <View
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                        style={[styles.corner, group.mine ? styles.cornerMine : styles.cornerTheirs]}>
                        {reactions.length > 0 ? (
                          <Animated.View
                            entering={reduced ? quietIn : cornerIn}
                            style={[
                              styles.reaction,
                              { backgroundColor: theme.page, boxShadow: `inset 0 0 0 1px ${theme.borderStrong}` },
                            ]}>
                            <Text allowFontScaling={false} style={styles.reactionEmoji}>
                              {reactions.map((reaction) => reaction.emoji).join('')}
                            </Text>
                          </Animated.View>
                        ) : null}
                        {replies.map((reply) => {
                          const own = reply.senderId === myId;
                          return (
                            <Animated.View
                              key={reply.id}
                              entering={reduced ? quietIn : cornerIn}
                              style={[
                                styles.reply,
                                own
                                  ? { backgroundColor: theme.inverse, borderColor: theme.page }
                                  : { backgroundColor: theme.surface, borderColor: theme.text },
                              ]}>
                              <ThemedText
                                numberOfLines={3}
                                themeColor={own ? 'onInverse' : 'text'}
                                style={styles.replyText}>
                                {own ? reply.text : filter(reply.text)}
                              </ThemedText>
                            </Animated.View>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })}
              {/* Each bubble already says its time to screen readers. */}
              <ThemedText
                type="caption"
                themeColor="textTertiary"
                accessibilityElementsHidden={!sent}
                importantForAccessibility={sent ? 'auto' : 'no'}
                accessibilityLabel={sent ? t('chat.sent') : undefined}
                style={styles.time}>
                {sent ? `${formatTime(lastSent)} · ${t('chat.sent')}` : formatTime(lastSent)}
              </ThemedText>
            </Animated.View>
          </View>
        );
      })}

      {waiting.map((item) => {
        const quoted = item.replyTo ? byId.get(item.replyTo) : undefined;
        return (
          <Animated.View key={item.localId} entering={quietIn} style={[styles.group, styles.mine]}>
            <View
              accessible
              accessibilityLabel={`${you}: ${item.voice ? t('chat.voiceMessage') : item.text}. ${item.failed ? t('chat.notSent') : t('chat.sending')}`}
              style={[bubbleStyle(true, false), styles.waiting]}>
              {quoted ? (
                <ThemedText type="caption" numberOfLines={1} style={[styles.quote, { color: theme.onInverse }]}>
                  {t('chat.quoteLine', {
                    text: quoted.senderId === myId ? quoted.text : filter(quoted.text),
                  })}
                </ThemedText>
              ) : null}
              {item.voice ? (
                <VoiceMessage voice={item.voice} mine active={false} onDone={() => {}} />
              ) : (
                body(item.text, true)
              )}
            </View>
            {item.failed ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('chat.notSent')}
                onPress={() => onRetry(item.localId)}
                hitSlop={10}>
                <ThemedText type="caption" themeColor="danger" style={styles.time}>
                  {t('chat.notSent')}
                </ThemedText>
              </Pressable>
            ) : (
              <ThemedText type="caption" themeColor="textTertiary" style={styles.time}>
                {t('chat.sending')}
              </ThemedText>
            )}
          </Animated.View>
        );
      })}

      {typing ? <TypingBubble label={t('chat.typing', { name })} /> : null}
    </View>
  );
}

type BubbleProps = {
  label: string;
  hint: string;
  style: React.ComponentProps<typeof View>['style'];
  onDoubleTap: () => void;
  /** VoiceOver's double tap on the bubble: plays or stops a voice message. */
  onActivate?: () => void;
  /** A long press, with where the bubble is on the screen. */
  onOpen: (anchor: BubbleAnchor) => void;
  children: React.ReactNode;
};

/** One message. A long press opens its reactions and Reply; VoiceOver gets the same as an action. */
function Bubble({ label, hint, style, onDoubleTap, onActivate, onOpen, children }: BubbleProps) {
  const ref = useRef<ViewInstance>(null);
  const tappedAt = useRef(0);
  function tap() {
    const now = Date.now();
    const double = now - tappedAt.current <= DOUBLE_TAP_MS;
    tappedAt.current = double ? 0 : now;
    if (double) onDoubleTap();
  }
  function open() {
    const node = ref.current;
    if (!node) return;
    node.measureInWindow((x, y, width, height) => onOpen({ x, y, width, height }));
  }
  return (
    <Pressable
      ref={ref}
      accessible
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityActions={[{ name: 'activate' }, { name: 'longpress' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'longpress') open();
        else if (event.nativeEvent.actionName === 'activate') onActivate?.();
      }}
      onPress={tap}
      onLongPress={open}
      delayLongPress={280}
      style={({ pressed }) => [style, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

/** A shared link's page: its picture, title and site. A tap opens it. */
function LinkCard({ link, mine, onOpen }: { link: LinkPreview; mine: boolean; onOpen: (url: string) => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${link.title}, ${link.site}`}
      onPress={() => onOpen(link.url)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: mine ? 'rgba(255,255,255,0.14)' : theme.page },
        !mine && { boxShadow: `inset 0 0 0 1px ${theme.border}` },
        pressed && styles.pressed,
      ]}>
      {link.image ? <Image source={{ uri: link.image }} contentFit="cover" style={styles.cardImage} /> : null}
      <View style={styles.cardText}>
        <ThemedText numberOfLines={2} themeColor={mine ? 'onInverse' : 'text'} style={styles.cardTitle}>
          {link.title}
        </ThemedText>
        <ThemedText
          type="caption"
          numberOfLines={1}
          style={{ color: mine ? theme.onInverse : theme.textTertiary, opacity: mine ? 0.7 : 1 }}>
          {link.site}
        </ThemedText>
      </View>
    </Pressable>
  );
}

/** They are typing: three dots that rise one after another, in a bubble on their side. */
function TypingBubble({ label }: { label: string }) {
  const theme = useTheme();
  const reduced = useReduceMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    turn.set(withRepeat(withTiming(1, { duration: 1200, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(turn);
  }, [reduced, turn]);
  return (
    <Animated.View
      entering={quietIn}
      accessible
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      style={[styles.group, styles.theirs]}>
      <View
        style={[
          styles.bubble,
          styles.typing,
          { backgroundColor: theme.field, boxShadow: `inset 0 0 0 1px ${theme.border}` },
        ]}>
        {[0, 1, 2].map((index) => (
          <TypingDot key={index} index={index} turn={turn} still={reduced} color={theme.textTertiary} />
        ))}
      </View>
    </Animated.View>
  );
}

function TypingDot({
  index,
  turn,
  still,
  color,
}: {
  index: number;
  turn: SharedValue<number>;
  still: boolean;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    if (still) return { opacity: 0.7, transform: [{ translateY: 0 }] };
    // Each dot's own wave, a sixth of a turn after the one before.
    const wave = Math.max(0, Math.sin((turn.get() - index * 0.16) * 2 * Math.PI));
    return { opacity: 0.4 + 0.6 * wave, transform: [{ translateY: -3 * wave }] };
  });
  return <Animated.View style={[styles.typingDot, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  dayAndGroup: {
    gap: 10,
  },
  // The day over its messages, centered.
  pillRow: {
    alignItems: 'center',
  },
  // The room's last round: a card as wide as the chat, over the first message.
  seed: {
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: Space.md,
    borderRadius: 20,
    borderCurve: 'continuous',
    marginBottom: Space.xs,
  },
  seedTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  seedKicker: {
    flex: 1,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: 600,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  seedQuestion: {
    fontSize: 16,
    lineHeight: 21,
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
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: BUBBLE_RADIUS,
    borderCurve: 'continuous',
  },
  pressed: {
    opacity: 0.8,
  },
  waiting: {
    opacity: 0.6,
  },
  /** Chat bubbles: 16/21. */
  text: {
    fontSize: 16,
    lineHeight: 21,
  },
  link: {
    textDecorationLine: 'underline',
  },
  /** The question asked in the room keeps its New York voice. */
  serif: {
    fontFamily: Fonts.serif,
  },
  quote: {
    opacity: 0.7,
    marginBottom: 2,
  },
  time: {
    marginTop: Space.xxs,
    paddingHorizontal: Space.xxs,
  },
  // What hangs on a bubble's lower corner: it climbs 10 pt onto the bubble and
  // sticks out a little past its outer edge.
  corner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    marginTop: -CORNER_OVERLAP,
    marginBottom: 2,
    maxWidth: 260,
    zIndex: 1,
  },
  cornerMine: {
    justifyContent: 'flex-end',
    marginRight: -6,
  },
  cornerTheirs: {
    justifyContent: 'flex-start',
    marginLeft: -6,
  },
  reaction: {
    minHeight: 26,
    paddingHorizontal: 7,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionEmoji: {
    fontSize: 14,
    lineHeight: 18,
  },
  // A reply on the corner of what it answers: a small pill with a strong edge.
  reply: {
    maxWidth: 230,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 2.5,
  },
  replyText: {
    fontSize: 15,
    lineHeight: 19,
  },
  card: {
    marginTop: Space.xs,
    width: 232,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 122,
  },
  cardText: {
    paddingVertical: Space.xs,
    paddingHorizontal: 10,
    gap: 2,
  },
  cardTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: 600,
  },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 41,
    borderBottomLeftRadius: TAIL,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
