import { Redirect, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
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

import { api, type Match, type Message, type ReportReason } from '@/api';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { ErrorLine } from '@/components/error-line';
import { LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Ease, Gutter, MinTouch, Motion, Space } from '@/constants/theme';
import { ChatComposer } from '@/features/chat/chat-composer';
import { MessageList } from '@/features/chat/message-list';
import { acknowledge, confirmStep, useChoice } from '@/features/chat/prompts';
import { BackButton } from '@/features/onboarding/back-button';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useRoom } from '@/hooks/use-server';
import { seatFor, useSeats, useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useSession } from '@/state/session';
import { useFilterText, useSettings } from '@/state/settings';
import { haptics } from '@/utils/haptics';

/** The reasons in the order the report sheet lists them. */
const REPORT_REASONS: { reason: ReportReason; key: string }[] = [
  { reason: 'harassment', key: 'chat.reasonHarassment' },
  { reason: 'inappropriate', key: 'chat.reasonInappropriate' },
  { reason: 'fake', key: 'chat.reasonFake' },
  { reason: 'underage', key: 'chat.reasonUnderage' },
  { reason: 'spam', key: 'chat.reasonSpam' },
  { reason: 'other', key: 'chat.reasonOther' },
];

/** Within this distance of the end, a new message scrolls into view; further up, you're reading. */
const NEAR_END = 80;

/** The first messages and the empty state arrive together, instead of popping in. */
const contentIn = FadeIn.duration(Motion.state).easing(Ease.out).reduceMotion(ReduceMotion.Never);

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
        footer={<Button title={t('chat.backHome')} onPress={leave} />}>
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
  const { choose, sheet } = useChoice();
  const scrollRef = useRef<ScrollViewInstance>(null);
  /** True while you're at the newest message, so new ones scroll into view. */
  const nearEnd = useRef(true);
  /** The first list jumps straight to the end; later messages scroll there. */
  const scrolledOnce = useRef(false);
  /** Null until the first list arrives, so the empty state never flashes. */
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Their latest message, for Android's and the web's live region. */
  const [heard, setHeard] = useState<string | null>(null);

  const { name, age } = match.other;
  const tone = seatFor(seats, match.other.id);
  const formatTime = makeTimeFormat(locale, region);
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
    return api.watchMessages(match.id, (list) => {
      setMessages(list);
      if (seen === null) {
        seen = new Set(list.map((message) => message.id));
        return;
      }
      for (const message of list) {
        if (seen.has(message.id)) continue;
        seen.add(message.id);
        if (message.senderId !== myId) hearIncoming(message);
      }
    });
  }, [match.id, myId]);

  function scrollToEnd(animated: boolean) {
    scrollRef.current?.scrollToEnd({ animated: animated && !reduced });
  }

  function trackScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    nearEnd.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - NEAR_END;
  }

  async function send() {
    const text = draft;
    if (!text.trim() || sending) return;
    setSending(true);
    setError(null);
    // Your own message always scrolls into view, even if you were reading further up.
    nearEnd.current = true;
    try {
      await api.sendMessage(match.id, text);
      haptics.light();
      // Keep anything typed while it was sending.
      setDraft((current) => (current.startsWith(text) ? current.slice(text.length) : current));
    } catch {
      fail(t('chat.sendFailed'));
    } finally {
      setSending(false);
    }
  }

  function fail(message: string) {
    setError(message);
    haptics.error();
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
  }

  async function openOptions() {
    if (busy) return;
    const picked = await choose({
      title: t('common.nameAge', { name, age }),
      choices: [{ label: t('chat.report') }, { label: t('chat.block'), destructive: true }],
    });
    if (picked === 0) await report();
    if (picked === 1) await block();
  }

  async function report() {
    const picked = await choose({
      title: t('chat.reportTitle', { name }),
      message: t('chat.reportMessage', { name }),
      choices: REPORT_REASONS.map(({ key }) => ({ label: t(key) })),
    });
    if (picked === null) return;
    setBusy(true);
    setError(null);
    try {
      await api.report(match.other.id, REPORT_REASONS[picked].reason);
      haptics.success();
      acknowledge(t('chat.reported'));
    } catch {
      fail(t('chat.reportFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function block() {
    const confirmed = await confirmStep({
      title: t('chat.blockTitle', { name }),
      message: t('chat.blockMessage', { name }),
      confirmLabel: t('chat.block'),
      cancelLabel: t('common.cancel'),
    });
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      await api.block(match.other.id);
      haptics.medium();
      leave();
    } catch {
      fail(t('chat.blockFailed', { name }));
      setBusy(false);
    }
  }

  return (
    <Screen
      contentStyle={styles.content}
      footer={
        <>
          {error ? <ErrorLine message={error} /> : null}
          <ChatComposer
            value={draft}
            onChangeText={setDraft}
            onSend={send}
            sending={sending}
            name={name}
          />
        </>
      }>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.back}>
          <BackButton onPress={leave} />
        </View>
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel={t('common.nameAge', { name, age })}
          style={styles.person}>
          <Avatar name={name} uri={match.other.photo} tone={tone} size={40} />
          <ThemedText type="row" numberOfLines={1} style={styles.name}>
            {t('common.nameAge', { name, age })}
          </ThemedText>
        </View>
        <OptionsButton
          label={t('chat.options')}
          hint={t('chat.optionsHint', { name })}
          disabled={busy}
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
        {messages === null ? null : messages.length === 0 ? (
          <Animated.View entering={contentIn} style={styles.empty}>
            <Avatar name={name} uri={match.other.photo} tone={tone} size={64} />
            <ThemedText type="callout" themeColor="textSecondary" style={styles.centeredText}>
              {emptyLine}
            </ThemedText>
          </Animated.View>
        ) : (
          <Animated.View entering={contentIn}>
            <MessageList
              messages={messages}
              myId={myId}
              name={name}
              filter={filter}
              formatTime={formatTime}
            />
          </Animated.View>
        )}
      </ScrollView>

      {/* Android and the web read their newest message from here; iOS announces it instead. */}
      {Platform.OS !== 'ios' ? (
        <ThemedText accessibilityLiveRegion="polite" style={styles.offscreen}>
          {heard ?? ''}
        </ThemedText>
      ) : null}

      {sheet}
    </Screen>
  );
}

/** The ellipsis in the header's corner: report or block. */
function OptionsButton({
  label,
  hint,
  disabled,
  onPress,
}: {
  label: string;
  hint: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
      style={({ pressed }) => [styles.options, (pressed || disabled) && styles.pressed]}>
      <SymbolView
        name={{ ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' }}
        size={20}
        tintColor={theme.text}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    minHeight: 56,
    paddingHorizontal: Gutter,
    paddingBottom: Space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: {
    justifyContent: 'center',
  },
  person: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  name: {
    flexShrink: 1,
  },
  // The glyph lines up with the gutter; the touch area stays 44pt.
  options: {
    width: MinTouch,
    height: MinTouch,
    marginRight: -Space.sm,
    alignItems: 'center',
    justifyContent: 'center',
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
