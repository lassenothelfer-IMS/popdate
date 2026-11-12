import { Redirect, router, Stack } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import * as WebBrowser from 'expo-web-browser';
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
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { api, type Match, type Message, type Room } from '@/api';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { ErrorLine } from '@/components/error-line';
import { keyboardDismissMode } from '@/components/keyboard';
import { Icon } from '@/components/icon';
import { LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { SideSwipe } from '@/components/side-swipe';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { VerifiedCheck } from '@/components/verified-check';
import { Ease, Fonts, Gutter, MinTouch, Motion, Radius, Space } from '@/constants/theme';
import { ChatComposer } from '@/features/chat/chat-composer';
import { MessageActions } from '@/features/chat/message-actions';
import { MatchProfileView, useMatchProfile } from '@/features/chat/match-profile';
import {
  MessageList,
  SEED_KEY,
  type BubbleAnchor,
  type PendingMessage,
  type Seed,
} from '@/features/chat/message-list';
import { CheckInSheet } from '@/features/chat/check-in-sheet';
import { MoreButton, usePersonActions } from '@/features/chat/person-actions';
import type { Recording } from '@/features/chat/voice-recorder';
import { voiceAvailable } from '@/features/chat/voice-support';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useRoom } from '@/hooks/use-server';
import { seatFor, useSeats, useTheme } from '@/hooks/use-theme';
import { useT, type Translate } from '@/i18n';
import { TYPING_MS, TYPING_PING_MS } from '@/shared/chat';
import { useSession } from '@/state/session';
import { useFilterText, useSettings } from '@/state/settings';
import { track } from '@/utils/analytics';
import { haptics } from '@/utils/haptics';

/**
 * The room's last round at the top of the chat: the question, and the answer
 * that kept the last balloon. The room only keeps its final round here; all of
 * them are on the Profile side.
 */
function seedFromRoom(room: Room | null | undefined, myId: string, t: Translate): Seed | null {
  if (!room || room.status !== 'finished' || !room.question) return null;
  const winner = room.contestants.find((contestant) => contestant.id === room.winnerId);
  const answer = winner?.answer ?? null;
  const answerMine = winner?.id === myId;
  // The photo the last round revealed: theirs, whichever of you two held the balloon.
  const them = room.popper.id === myId ? winner : room.popper;
  return {
    photo: them?.photos.at(-1),
    name: them?.name ?? '',
    kicker: !answer
      ? t('chat.seedQuestion')
      : answerMine
        ? t('chat.seedYours')
        : t('chat.seedTheirs', { name: winner?.name ?? '' }),
    question: room.question.text,
    answer,
    answerMine,
  };
}

type Tab = 'chat' | 'profile';

/** The recorder, loaded only where the phone's audio module exists. */
const recorder = voiceAvailable
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded only where the audio module exists, or the chat would crash without it
    (require('@/features/chat/voice-recorder') as typeof import('@/features/chat/voice-recorder'))
  : null;

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
  const day: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
  const weekday: Intl.DateTimeFormatOptions = { weekday: 'long' };
  const date: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const make = (options: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat(tag, options);
    } catch {
      // A region the phone's Intl doesn't know: the language alone still reads right.
      return new Intl.DateTimeFormat(locale, options);
    }
  };
  const formats = { time: make(time), dated: make(dated), day: make(day), weekday: make(weekday), date: make(date) };
  return {
    /** When you matched: today just the time, earlier days the date too. */
    stamp(iso: string) {
      const date = new Date(iso);
      const today = new Date().toDateString() === date.toDateString();
      return (today ? formats.time : formats.dated).format(date);
    },
    /** The day you matched, for the header: today, a weekday within the week, or the date. */
    matched(iso: string): { when: 'today' } | { when: 'weekday' | 'date'; day: string } {
      const then = new Date(iso);
      const now = new Date();
      if (now.toDateString() === then.toDateString()) return { when: 'today' };
      const days = (now.getTime() - then.getTime()) / (24 * 60 * 60_000);
      return days < 6
        ? { when: 'weekday', day: formats.weekday.format(then) }
        : { when: 'date', day: formats.date.format(then) };
    },
    /** A message's time. Its day stands on the divider above it. */
    clock: (iso: string) => formats.time.format(new Date(iso)),
    /** The divider over a day's messages: null for today and yesterday, which have their own words. */
    day(iso: string): 'today' | 'yesterday' | string {
      const date = new Date(iso);
      const now = new Date();
      if (now.toDateString() === date.toDateString()) return 'today';
      const before = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      if (before.toDateString() === date.toDateString()) return 'yesterday';
      return formats.day.format(date);
    },
  };
}

/** A local id for a message that hasn't been sent yet. */
let pendingCount = 0;

function Conversation({ match, myId }: { match: Match; myId: string }) {
  const t = useT();
  const theme = useTheme();
  const seats = useSeats();
  const reduced = useReduceMotion();
  const filter = useFilterText();
  // On iOS the system's navigation bar is over the chat: the screen starts under it.
  const barHeight = useHeaderHeight();
  const headerHeight = Platform.OS === 'ios' ? barHeight : 0;
  const { locale, region } = useSettings();
  const room = useRoom(match.roomId);
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
  const times = useMemo(() => makeTimeFormat(locale, region), [locale, region]);
  /** Chat or Profile: the two sides of a match. */
  const [tab, setTab] = useState<Tab>('chat');
  /** The Profile side is drawn from the first time it is opened, and then kept. */
  const [profileOpened, setProfileOpened] = useState(false);
  /** "Plan a date" on the profile brings the date ideas back out, however long the chat is. */
  const [ideasOut, setIdeasOut] = useState(false);
  const theirProfile = useMatchProfile(match.id);
  const verified = theirProfile.profile?.verified === true;
  const matched = times.matched(match.createdAt);
  const matchedLine =
    matched.when === 'today'
      ? t('chat.matchedToday')
      : t(matched.when === 'weekday' ? 'chat.matchedOnWeekday' : 'chat.matchedOnDate', { day: matched.day });

  /** 0 on the chat, 1 on the profile: the two sides trade places as it moves. */
  const side = useSharedValue(0);
  function show(next: Tab) {
    if (next === tab) return;
    haptics.selection();
    if (next === 'profile') setProfileOpened(true);
    setTab(next);
    const to = next === 'profile' ? 1 : 0;
    side.set(reduced ? to : withTiming(to, { duration: 280, easing: Easing.bezier(0.3, 0, 0.2, 1) }));
  }
  const chatPane = useAnimatedStyle(() => ({
    opacity: 1 - side.get(),
    transform: [{ translateX: -36 * side.get() }],
  }));
  const profilePane = useAnimatedStyle(() => ({
    opacity: side.get(),
    transform: [{ translateX: 36 * (1 - side.get()) }],
  }));
  const tabLine = useAnimatedStyle(() => ({ left: `${side.get() * 50}%` }));
  const formatDay = (iso: string) => {
    const day = times.day(iso);
    return day === 'today' ? t('chat.today') : day === 'yesterday' ? t('chat.yesterday') : day;
  };
  /** Your messages on their way, or that didn't go through. */
  const [pending, setPending] = useState<PendingMessage[]>([]);
  /** The message you are answering. */
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  /** The message whose reactions bar is open, and where its bubble is. */
  const [acting, setActing] = useState<{ message: Message; anchor: BubbleAnchor } | null>(null);
  /** When they last typed. Shown as "typing" for a few seconds after. */
  const [typedAt, setTypedAt] = useState<number | null>(null);
  const [typing, setTyping] = useState(false);
  const seed = seedFromRoom(room, myId, t);
  // You were the one picked when you're the room's winner; otherwise you chose together.
  const winner = room?.winnerId != null && room.winnerId === myId;
  const emptyLine = t(winner ? 'chat.emptyWinner' : 'chat.emptyTogether', { name });

  const hearIncoming = useEffectEvent((message: Message) => {
    const line = t('chat.incoming', {
      name,
      text: message.voice ? t('chat.voiceMessage') : filter(message.text),
    });
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
        setFirstOpen(new Set([SEED_KEY, ...seen]));
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

  useEffect(() => api.watchTyping(match.id, setTypedAt), [match.id]);
  // "Typing" lasts a few seconds past their last keystroke, and ends when their message lands.
  const theirLast = messages?.findLast((message) => message.senderId !== myId)?.id ?? null;
  useEffect(() => {
    const left = typedAt === null ? 0 : TYPING_MS - (Date.now() - typedAt);
    const show = setTimeout(() => setTyping(left > 0), 0);
    const hide = left > 0 ? setTimeout(() => setTyping(false), left) : undefined;
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [typedAt]);
  useEffect(() => {
    const id = setTimeout(() => setTyping(false), 0);
    return () => clearTimeout(id);
  }, [theirLast]);

  function scrollToEnd(animated: boolean) {
    scrollRef.current?.scrollToEnd({ animated: animated && !reduced });
  }

  function trackScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    nearEnd.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - NEAR_END;
  }

  /** Sends one pending message. It shows at once; the server's copy takes its place when it arrives. */
  function deliver(item: PendingMessage) {
    const first = !messages?.some((message) => message.senderId === myId);
    const going = item.voice
      ? api.sendVoice(
          match.id,
          { uri: item.voice.url, durationMs: item.voice.durationMs, waveform: item.voice.waveform },
          item.replyTo,
        )
      : api.sendMessage(match.id, item.text, item.replyTo);
    going.then(
      (sent) => {
        if (first) track('first_message_sent');
        haptics.light();
        setPending((list) =>
          list.map((other) => (other.localId === item.localId ? { ...other, sentId: sent.id } : other)),
        );
      },
      () => {
        haptics.error();
        if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(t('chat.sendFailed'));
        setPending((list) =>
          list.map((other) => (other.localId === item.localId ? { ...other, failed: true } : other)),
        );
      },
    );
  }

  function send(text: string, recording?: Recording) {
    // Your own message always scrolls into view, even if you were reading further up.
    nearEnd.current = true;
    pendingCount += 1;
    const item: PendingMessage = {
      localId: `pending-${pendingCount}`,
      text: text.trim(),
      voice: recording
        ? { url: recording.uri, durationMs: recording.durationMs, waveform: recording.waveform }
        : undefined,
      replyTo: replyingTo?.id,
      failed: false,
    };
    setReplyingTo(null);
    // Messages the server has since delivered leave the waiting list.
    setPending((list) => [
      ...list.filter((other) => !other.sentId || !messages?.some((message) => message.id === other.sentId)),
      item,
    ]);
    deliver(item);
  }

  function retrySend(localId: string) {
    const item = pending.find((other) => other.localId === localId);
    if (!item) return;
    const again = { ...item, failed: false };
    setPending((list) => list.map((other) => (other.localId === localId ? again : other)));
    deliver(again);
  }

  function react(message: Message, emoji: string | null) {
    haptics.selection();
    api.reactToMessage(match.id, message.id, emoji).catch(() => haptics.error());
  }

  /** A double tap gives a heart, or takes yours back. */
  function heart(message: Message) {
    const mine = message.reactions?.find((reaction) => reaction.userId === myId)?.emoji;
    react(message, mine === '❤️' ? null : '❤️');
  }

  function openLink(url: string) {
    WebBrowser.openBrowserAsync(url).catch(() => {});
  }

  function openOptions() {
    void people.open({ id: match.other.id, name, age, matchId: match.id }, [
      { label: t('checkin.title'), onPress: () => setCheckingIn(true) },
    ]);
  }

  return (
    <Screen
      contentStyle={styles.content}
      headerHeight={headerHeight}
      footerHidden={tab !== 'chat'}
      footer={
        <ChatFooter
          matchId={match.id}
          name={name}
          messageCount={messages?.length ?? null}
          ideasOut={ideasOut}
          onSend={send}
          onSendVoice={(recording) => send('', recording)}
          replyingTo={
            replyingTo
              ? {
                  label:
                    replyingTo.senderId === myId
                      ? t('chat.replyingToSelf')
                      : t('chat.replyingTo', { name }),
                  text: replyingTo.senderId === myId ? replyingTo.text : filter(replyingTo.text),
                }
              : null
          }
          onCancelReply={() => setReplyingTo(null)}
        />
      }>
      {/* On iOS the system's navigation bar carries the chat's top: its own back button
          (glass on iOS 26, with the swipe from the edge), who you're talking to in the
          middle, and the options on the right. Elsewhere the app draws the same row. */}
      {Platform.OS === 'ios' ? (
        <Stack.Screen
          options={{
            headerShown: true,
            headerShadowVisible: false,
            headerBackButtonDisplayMode: 'minimal',
            headerTintColor: theme.text,
            headerStyle: { backgroundColor: theme.page },
            headerTitle: () => (
              <View
                accessible
                accessibilityRole="header"
                accessibilityLabel={[
                  t('common.nameAge', { name, age }),
                  verified ? t('home.verifiedLabel') : '',
                  matchedLine,
                ]
                  .filter(Boolean)
                  .join(', ')}
                style={styles.person}>
                <Avatar name={name} uri={match.other.photo} tone={tone} size={32} />
                <View style={styles.name}>
                  <View style={styles.nameRow}>
                    <ThemedText type="task" numberOfLines={1} style={styles.nameText}>
                      {name}
                    </ThemedText>
                    {verified ? <VerifiedCheck /> : null}
                  </View>
                  <ThemedText type="footnote" themeColor="textSecondary" numberOfLines={1}>
                    {matchedLine}
                  </ThemedText>
                </View>
              </View>
            ),
            headerRight: () => (
              <MoreButton
                label={t('chat.options')}
                hint={t('chat.optionsHint', { name })}
                disabled={people.busy}
                onPress={openOptions}
              />
            ),
          }}
        />
      ) : (
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
            accessibilityLabel={[
              t('common.nameAge', { name, age }),
              verified ? t('home.verifiedLabel') : '',
              matchedLine,
            ]
              .filter(Boolean)
              .join(', ')}
            style={styles.person}>
            <Avatar name={name} uri={match.other.photo} tone={tone} size={40} />
            <View style={styles.name}>
              <View style={styles.nameRow}>
                <ThemedText type="task" numberOfLines={1} style={styles.nameText}>
                  {name}
                </ThemedText>
                {verified ? <VerifiedCheck /> : null}
              </View>
              <ThemedText type="footnote" themeColor="textSecondary" numberOfLines={1}>
                {matchedLine}
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
      )}

      <View accessibilityRole="tablist" style={[styles.tabs, { borderBottomColor: theme.border }]}>
        {(['chat', 'profile'] as const).map((side) => {
          const selected = tab === side;
          return (
            <Pressable
              key={side}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              aria-selected={selected}
              onPress={() => show(side)}
              style={styles.tab}>
              <ThemedText style={[styles.tabLabel, selected ? styles.tabLabelOn : { color: theme.textSecondary }]}>
                {t(side === 'chat' ? 'chat.tabChat' : 'chat.tabProfile')}
              </ThemedText>
            </Pressable>
          );
        })}
        {/* One line, which travels to whichever side you are on. */}
        <Animated.View style={[styles.tabLineTrack, tabLine]} pointerEvents="none">
          <View style={[styles.tabLine, { backgroundColor: theme.text }]} />
        </Animated.View>
      </View>

      <View style={styles.fill}>

      {profileOpened ? (
        <Animated.View
          style={[StyleSheet.absoluteFill, profilePane]}
          pointerEvents={tab === 'profile' ? 'auto' : 'none'}
          accessibilityElementsHidden={tab !== 'profile'}
          importantForAccessibility={tab === 'profile' ? 'auto' : 'no-hide-descendants'}>
          <MatchProfileView
            load={theirProfile}
            name={name}
            onSwipeBack={() => show('chat')}
            onPlanDate={() => {
              setIdeasOut(true);
              show('chat');
            }}
          />
        </Animated.View>
      ) : null}

      {/* A swipe to the left on the chat opens their profile. */}
      <Animated.View
        style={[StyleSheet.absoluteFill, chatPane]}
        pointerEvents={tab === 'chat' ? 'auto' : 'none'}
        accessibilityElementsHidden={tab !== 'chat'}
        importantForAccessibility={tab === 'chat' ? 'auto' : 'no-hide-descendants'}>
      <SideSwipe onLeft={() => show('profile')}>
      <ScrollView
        ref={scrollRef}
        style={styles.fill}
        contentContainerStyle={styles.messages}
        keyboardShouldPersistTaps="handled"
        // Drag the messages down and the keyboard follows your finger, the field riding on it.
        keyboardDismissMode={keyboardDismissMode}
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
        ) : messages.length === 0 && pending.length === 0 && !typing && !seed ? (
          <Animated.View entering={contentIn} style={styles.empty}>
            <Avatar name={name} uri={match.other.photo} tone={tone} size={64} />
            <ThemedText type="body" themeColor="textSecondary" style={styles.centeredText}>
              {emptyLine}
            </ThemedText>
          </Animated.View>
        ) : (
          <MessageList
            messages={messages}
            pending={pending}
            myId={myId}
            name={name}
            filter={filter}
            formatTime={times.clock}
            formatDay={formatDay}
            seed={seed}
            firstOpen={firstOpen}
            typing={typing}
            onOpenActions={(message, anchor) => {
              haptics.selection();
              setActing({ message, anchor });
            }}
            onHeart={heart}
            onRetry={retrySend}
            onOpenLink={openLink}
          />
        )}
      </ScrollView>
      </SideSwipe>
      </Animated.View>
      </View>

      {/* Android and the web read their newest message from here; iOS announces it instead. */}
      {Platform.OS !== 'ios' ? (
        <ThemedText accessibilityLiveRegion="polite" style={styles.offscreen}>
          {heard ?? ''}
        </ThemedText>
      ) : null}

      <MessageActions
        anchor={acting?.anchor ?? null}
        mine={acting?.message.senderId === myId}
        current={acting?.message.reactions?.find((reaction) => reaction.userId === myId)?.emoji ?? null}
        onReact={(emoji) => {
          if (acting) react(acting.message, emoji);
          setActing(null);
        }}
        onReply={() => {
          if (acting) setReplyingTo(acting.message);
          setActing(null);
        }}
        onClose={() => setActing(null)}
      />
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
  matchId: string;
  name: string;
  /** How many messages there are, or null while they load. */
  messageCount: number | null;
  /** Show the date ideas even in a long chat: "Plan a date" was pressed. */
  ideasOut: boolean;
  /** Sends one message. It shows in the chat at once, with how it went. */
  onSend: (text: string) => void;
  onSendVoice: (recording: Recording) => void;
  replyingTo: { label: string; text: string } | null;
  onCancelReply: () => void;
};

/**
 * Under the messages: date ideas while the chat is young, what you are answering,
 * and the composer. The draft lives here, so typing doesn't redraw the messages above.
 */
function ChatFooter({
  matchId,
  name,
  messageCount,
  ideasOut,
  onSend,
  onSendVoice,
  replyingTo,
  onCancelReply,
}: ChatFooterProps) {
  const t = useT();
  const theme = useTheme();
  const [draft, setDraft] = useState('');
  /** A voice message is being recorded, in the message field's place. */
  const [recording, setRecording] = useState(false);
  /** Why the last recording didn't happen: no microphone access, or it failed. */
  const [recordError, setRecordError] = useState<string | null>(null);
  /** When the server last heard that you type, so it hears at most every few seconds. */
  const toldAt = useRef(0);

  function send() {
    const text = draft;
    if (!text.trim()) return;
    setDraft('');
    onSend(text);
  }

  function change(text: string) {
    setDraft(text);
    const now = Date.now();
    if (text.trim() && now - toldAt.current >= TYPING_PING_MS) {
      toldAt.current = now;
      // Only a hint for the other person: a miss costs nothing.
      api.setTyping(matchId).catch(() => {});
    }
  }

  // Early on, a few date ideas sit over the composer; a tap drafts one to edit and send.
  const showIdeas =
    messageCount !== null &&
    (ideasOut || messageCount < DATE_IDEAS_UNTIL) &&
    !draft &&
    !replyingTo &&
    !recording;

  return (
    <>
      {recordError ? <ErrorLine message={recordError} /> : null}
      {showIdeas ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.ideas}
          accessibilityLabel={t('chat.ideasLabel')}>
          <View style={[styles.ideasLabel, { backgroundColor: theme.brandWash }]}>
            <ThemedText style={[styles.ideasLabelText, { color: theme.brand }]}>{t('chat.planDate')}</ThemedText>
          </View>
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
      {recording && recorder ? (
        <recorder.VoiceRecorder
          onSend={(taken) => {
            setRecording(false);
            onSendVoice(taken);
          }}
          onClose={(error) => {
            setRecording(false);
            if (error) {
              setRecordError(error);
              haptics.error();
              if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(error);
            }
          }}
        />
      ) : (
        <ChatComposer
          value={draft}
          onChangeText={change}
          onSend={send}
          sending={false}
          name={name}
          replyingTo={replyingTo}
          onCancelReply={onCancelReply}
          // No mic button where this app can't record.
          onRecord={
            recorder
              ? () => {
                  setRecordError(null);
                  setRecording(true);
                }
              : undefined
          }
        />
      )}
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
  // Names the row: the same pill as the ideas, in the brand's wash, and not a button.
  ideasLabel: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Space.md,
    borderRadius: Radius.pill,
    borderCurve: 'continuous',
  },
  ideasLabelText: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 500,
  },
  // Chat | Profile: one pill, the chosen side lifted in white.
  // Chat | Profile: two words over a hairline, with a line under the one you are on.
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    minHeight: MinTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLineTrack: {
    position: 'absolute',
    bottom: -1,
    width: '50%',
    paddingHorizontal: Gutter,
  },
  tabLine: {
    height: 2,
    borderRadius: 1,
  },
  tabLabel: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 500,
  },
  tabLabelOn: {
    fontWeight: 600,
  },
  hidden: {
    display: 'none',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
