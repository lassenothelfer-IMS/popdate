import { Redirect, router } from 'expo-router';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { api, type Match, type Message, type Room } from '@/api';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { ErrorLine } from '@/components/error-line';
import { Icon } from '@/components/icon';
import { LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Ease, Gutter, MinTouch, Motion, Radius, Space } from '@/constants/theme';
import { ChatComposer } from '@/features/chat/chat-composer';
import { MessageList, type Seed } from '@/features/chat/message-list';
import { CheckInSheet } from '@/features/chat/check-in-sheet';
import { MoreButton, usePersonActions } from '@/features/chat/person-actions';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useRoom } from '@/hooks/use-server';
import { seatFor, useSeats, useTheme } from '@/hooks/use-theme';
import { useT, type Translate } from '@/i18n';
import { useSession } from '@/state/session';
import { useFilterText, useSettings } from '@/state/settings';
import { track } from '@/utils/analytics';
import { haptics } from '@/utils/haptics';
import { setOpenChat } from '@/utils/push-routing';

/** The seed's pieces are always these, so the first open knows to rise them in before the room loads. */
const SEED_KEYS = ['seed-pill', 'seed-question', 'seed-answer'] as const;

/**
 * The room's last round at the top of the chat: who asked what, and the answer
 * that kept the last balloon. The room only keeps its final round, so earlier
 * rounds can't be seeded yet.
 */
function seedFromRoom(room: Room | null | undefined, myId: string, t: Translate): Seed | null {
  if (!room || room.status !== 'finished' || !room.question) return null;
  const winner = room.contestants.find((contestant) => contestant.id === room.winnerId);
  const round = room.round;
  const askedByMe = room.popper.id === myId;
  const entries: Seed['entries'] = [
    {
      key: SEED_KEYS[1],
      mine: askedByMe,
      label: askedByMe ? t('chat.youAsked', { round }) : t('chat.theyAsked', { name: room.popper.name, round }),
      text: room.question.text,
      question: true,
    },
  ];
  if (winner?.answer) {
    const answeredByMe = winner.id === myId;
    entries.push({
      key: SEED_KEYS[2],
      mine: answeredByMe,
      label: answeredByMe ? t('chat.youAnswered') : t('chat.theyAnswered', { name: winner.name }),
      text: winner.answer,
      question: false,
    });
  }
  return { pill: t('chat.seedPill', { count: room.totalRounds }), entries };
}

/** Within this distance of the end, a new message scrolls into view; further up, you're reading. */
const NEAR_END = 80;

/** The first messages and the empty state arrive together, instead of popping in. */
const contentIn = FadeIn.duration(Motion.state).easing(Ease.out).reduceMotion(ReduceMotion.Never);

/** Date ideas offered while a chat is young, until this many messages. */
const DATE_IDEAS_UNTIL = 8;
const DATE_IDEAS = ['Coffee', 'Walk', 'Drinks', 'Dinner'] as const;

/** A quick load shows nothing instead of blocks that blink, as on LoadingScreen. */
const SKELETON_DELAY_MS = 400;
/** Messages that haven't come after this long count as failed, with a way to try again. */
const MESSAGES_TIMEOUT_MS = 10_000;

/** Back to wherever the chat was opened from; after a reload, Home. */
function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/home');
}

export function ChatScreen({ matchId }: { matchId: string }) {
  const t = useT();
  const { profile } = useSession();
  const [match, setMatch] = useState<Match | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    api.getMatch(matchId).then(
      (found) => {
        if (active) setMatch(found);
      },
      () => {
        if (active) setMatch(null);
      },
    );
    return () => {
      active = false;
    };
  }, [matchId]);

  if (!profile) return <Redirect href="/" />;
  if (match === undefined) return <LoadingScreen label={t('chat.loading')} />;

  if (match === null) {
    return (
      <Screen
        contentStyle={styles.centered}
        footerStyle="plain"
        // Says where it goes: back if there's somewhere to go back to, else Home.
        footer={
          <Button title={router.canGoBack() ? t('common.back') : t('chat.backHome')} onPress={leave} />
        }>
        <ThemedText themeColor="textSecondary" style={styles.centeredText}>
          {t('chat.notFound')}
        </ThemedText>
      </Screen>
    );
  }

  return <Conversation match={match} myId={profile.id} />;
}

/** Times in your language and region: today just the time, earlier days the date too. */
function makeTimeFormat(locale: string, region: string | null) {
  const tag = region ? `${locale}-${region}` : locale;
  const time: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  const dated: Intl.DateTimeFormatOptions = { ...time, day: 'numeric', month: 'short' };
  let formats: { time: Intl.DateTimeFormat; dated: Intl.DateTimeFormat };
  try {
    formats = { time: new Intl.DateTimeFormat(tag, time), dated: new Intl.DateTimeFormat(tag, dated) };
  } catch {
    // A region the phone's Intl doesn't know: the language alone still reads right.
    formats = {
      time: new Intl.DateTimeFormat(locale, time),
      dated: new Intl.DateTimeFormat(locale, dated),
    };
  }
  return (iso: string) => {
    const date = new Date(iso);
    const today = new Date().toDateString() === date.toDateString();
    return (today ? formats.time : formats.dated).format(date);
  };
}

function Conversation({ match, myId }: { match: Match; myId: string }) {
  const t = useT();
  const theme = useTheme();
  const seats = useSeats();
  const reduced = useReduceMotion();
  const filter = useFilterText();
  const { locale, region } = useSettings();
  const room = useRoom(match.roomId);
  useEffect(() => {
    setOpenChat(match.id);
    return () => setOpenChat(null);
  }, [match.id]);
  // Report, block or unmatch; any of the last two closes the chat.
  const people = usePersonActions({ onGone: leave });
  const [checkingIn, setCheckingIn] = useState(false);
  /** Bumped by Try again, which watches the messages afresh. */
  const [attempt, setAttempt] = useState(0);
  /** The messages took too long to come. */
  const [stalled, setStalled] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  /** True while you're at the newest message, so new ones scroll into view. */
  const nearEnd = useRef(true);
  /** The first list jumps straight to the end; later messages scroll there. */
  const scrolledOnce = useRef(false);
  /** Null until the first list arrives, so the empty state never flashes. */
  const [messages, setMessages] = useState<Message[] | null>(null);
  /** Their latest message, for Android's and the web's live region. */
  const [heard, setHeard] = useState<string | null>(null);
  /** What was on screen when the chat opened: only that rises in. */
  const [firstOpen, setFirstOpen] = useState<ReadonlySet<string> | null>(null);

  const { name, age } = match.other;
  const tone = seatFor(seats, match.other.id);
  const formatTime = useMemo(() => makeTimeFormat(locale, region), [locale, region]);
  const seed = seedFromRoom(room, myId, t);
  // You were the one picked when you're the room's winner; otherwise you chose together.
  const winner = room?.winnerId != null && room.winnerId === myId;
  const emptyLine = t(winner ? 'chat.emptyWinner' : 'chat.emptyTogether', { name });

  const hearIncoming = useEffectEvent((message: Message) => {
    const line = t('chat.incoming', { name, text: filter(message.text) });
    // VoiceOver ignores live regions, so iOS queues an announcement after whatever it's saying.
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibilityWithOptions(line, { queue: true });
    } else {
      setHeard(line);
    }
  });

  useEffect(() => {
    /** Messages already on screen; the first list is read by the screen reader itself. */
    let seen: Set<string> | null = null;
    const timer = setTimeout(() => setStalled(true), MESSAGES_TIMEOUT_MS);
    const unwatch = api.watchMessages(match.id, (list) => {
      clearTimeout(timer);
      setStalled(false);
      setMessages(list);
      if (seen === null) {
        seen = new Set(list.map((message) => message.id));
        setFirstOpen(new Set([...SEED_KEYS, ...seen]));
        return;
      }
      for (const message of list) {
        if (seen.has(message.id)) continue;
        seen.add(message.id);
        if (message.senderId !== myId) hearIncoming(message);
      }
    }, () => {
      clearTimeout(timer);
      setStalled(true);
    });
    return () => {
      clearTimeout(timer);
      unwatch();
    };
  }, [match.id, myId, attempt]);

  function retry() {
    setStalled(false);
    setAttempt((count) => count + 1);
  }

  function scrollToEnd(animated: boolean) {
    scrollRef.current?.scrollToEnd({ animated: animated && !reduced });
  }

  function trackScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    nearEnd.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - NEAR_END;
  }

  function send(text: string) {
    // Your own message always scrolls into view, even if you were reading further up.
    nearEnd.current = true;
    const first = !messages?.some((message) => message.senderId === myId);
    return api.sendMessage(match.id, text).then((sent) => {
      if (first) track('first_message_sent');
      return sent;
    });
  }

  function openOptions() {
    void people.open({ id: match.other.id, name, age, matchId: match.id }, [
      { label: t('checkin.title'), onPress: () => setCheckingIn(true) },
    ]);
  }

  return (
    <Screen
      contentStyle={styles.content}
      footer={<ChatFooter name={name} messageCount={messages?.length ?? null} onSend={send} />}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={leave}
          pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
          style={({ pressed }) => [styles.iconButton, styles.back, pressed && styles.pressed]}>
          <Icon name="back" size={20} color={theme.text} />
        </Pressable>
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel={`${t('common.nameAge', { name, age })}, ${t('chat.matchedAt', { time: formatTime(match.createdAt) })}`}
          style={styles.person}>
          <Avatar name={name} uri={match.other.photo} tone={tone} size={40} />
          <View style={styles.name}>
            <ThemedText type="task" numberOfLines={1} style={styles.nameText}>
              {t('common.nameAge', { name, age })}
            </ThemedText>
            <ThemedText type="caption" themeColor="textTertiary" numberOfLines={1}>
              {t('chat.matchedAt', { time: formatTime(match.createdAt) })}
            </ThemedText>
          </View>
        </View>
        <MoreButton
          label={t('chat.options')}
          hint={t('chat.optionsHint', { name })}
          disabled={people.busy}
          onPress={openOptions}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.fill}
        contentContainerStyle={styles.messages}
        keyboardShouldPersistTaps="handled"
        // On-drag rather than interactive: the footer can't follow an interactive drag.
        // On web a click starts a scroll gesture, so any dismiss mode would blur the field.
        keyboardDismissMode={Platform.select({ ios: 'on-drag', android: 'on-drag', default: 'none' })}
        onScroll={trackScroll}
        scrollEventThrottle={64}
        // The newest message stays in view as messages arrive and the keyboard comes and goes.
        onContentSizeChange={() => {
          if (nearEnd.current) scrollToEnd(scrolledOnce.current);
          scrolledOnce.current = true;
        }}
        onLayout={() => {
          if (nearEnd.current) scrollToEnd(false);
        }}>
        {messages === null ? (
          stalled ? (
            <View style={styles.empty}>
              <ErrorLine message={t('chat.loadFailed')} />
              <Button title={t('common.tryAgain')} variant="tinted" fullWidth={false} onPress={retry} />
            </View>
          ) : (
            <MessagesLoading label={t('chat.loading')} />
          )
        ) : messages.length === 0 && !seed ? (
          <Animated.View entering={contentIn} style={styles.empty}>
            <Avatar name={name} uri={match.other.photo} tone={tone} size={64} />
            <ThemedText type="body" themeColor="textSecondary" style={styles.centeredText}>
              {emptyLine}
            </ThemedText>
          </Animated.View>
        ) : (
          <MessageList
            messages={messages}
            myId={myId}
            name={name}
            filter={filter}
            formatTime={formatTime}
            seed={seed}
            firstOpen={firstOpen}
          />
        )}
      </ScrollView>

      {/* Android and the web read their newest message from here; iOS announces it instead. */}
      {Platform.OS !== 'ios' ? (
        <ThemedText accessibilityLiveRegion="polite" style={styles.offscreen}>
          {heard ?? ''}
        </ThemedText>
      ) : null}

      {people.element}
      <CheckInSheet
        visible={checkingIn}
        name={name}
        matchId={match.id}
        onClose={() => setCheckingIn(false)}
      />
    </Screen>
  );
}

type ChatFooterProps = {
  name: string;
  /** How many messages there are, or null while they load. */
  messageCount: number | null;
  /** Sends one message; rejects if it didn't go through. */
  onSend: (text: string) => Promise<unknown>;
};

/**
 * Under the messages: a send error, date ideas while the chat is young, and the
 * composer. The draft lives here, so typing doesn't redraw the messages above.
 */
function ChatFooter({ name, messageCount, onSend }: ChatFooterProps) {
  const t = useT();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function send() {
    const text = draft;
    if (!text.trim() || sending) return;
    setSending(true);
    setError(null);
    onSend(text).then(
      () => {
        setSending(false);
        haptics.light();
        // Keep anything typed while it was sending.
        setDraft((current) => (current.startsWith(text) ? current.slice(text.length) : current));
      },
      () => {
        setSending(false);
        fail(t('chat.sendFailed'));
      },
    );
  }

  function fail(message: string) {
    setError(message);
    haptics.error();
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
  }

  // Early on, a few date ideas sit over the composer; a tap drafts one to edit and send.
  const showIdeas = messageCount !== null && messageCount < DATE_IDEAS_UNTIL && !draft;

  return (
    <>
      {error ? <ErrorLine message={error} /> : null}
      {showIdeas ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.ideas}
          accessibilityLabel={t('chat.ideasLabel')}>
          {DATE_IDEAS.map((idea) => (
            <Chip
              key={idea}
              label={t(`chat.idea${idea}`)}
              selected={false}
              onPress={() => setDraft(t(`chat.idea${idea}Message`))}
            />
          ))}
        </ScrollView>
      ) : null}
      <ChatComposer value={draft} onChangeText={setDraft} onSend={send} sending={sending} name={name} />
    </>
  );
}

/** While the messages load: a few bubble-shaped blocks, theirs and yours, after a short pause. */
function MessagesLoading({ label }: { label: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setVisible(true), SKELETON_DELAY_MS);
    return () => clearTimeout(id);
  }, []);

  if (!visible) return null;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={styles.loading}>
      <Skeleton style={[styles.bubbleSkeleton, styles.theirsSkeleton, styles.wide]} />
      <Skeleton style={[styles.bubbleSkeleton, styles.mineSkeleton, styles.narrow]} />
      <Skeleton style={[styles.bubbleSkeleton, styles.theirsSkeleton, styles.middle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    gap: 10,
  },
  // About one line of bubble: 10 above and below a 21 pt line.
  bubbleSkeleton: {
    height: 41,
    borderRadius: Radius.xl,
  },
  theirsSkeleton: {
    alignSelf: 'flex-start',
  },
  mineSkeleton: {
    alignSelf: 'flex-end',
  },
  wide: {
    width: '62%',
  },
  narrow: {
    width: '48%',
  },
  middle: {
    width: '55%',
  },
  ideas: {
    gap: Space.xs,
    paddingBottom: Space.xs,
  },
  centered: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredText: {
    textAlign: 'center',
  },
  // The header and the messages bring their own gutters, so the hairline runs edge to edge.
  content: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  // The handoff's chat header: back, a 40 pt avatar, name over when you matched, options.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    minHeight: 56,
    paddingHorizontal: Gutter,
    paddingBottom: Space.xs,
  },
  iconButton: {
    width: MinTouch,
    height: MinTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The chevron lines up with the gutter.
  back: {
    marginLeft: -12,
  },
  person: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  name: {
    flexShrink: 1,
    gap: 1,
  },
  nameText: {
    fontSize: 16,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.6,
  },
  fill: {
    flex: 1,
  },
  messages: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: Gutter,
    paddingTop: Space.md,
    paddingBottom: Space.md,
  },
  empty: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.md,
    paddingHorizontal: Space.lg,
  },
  // Read by screen readers, never seen.
  offscreen: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
});
