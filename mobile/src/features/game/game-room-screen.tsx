import { router } from 'expo-router';
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  Keyframe,
  LayoutAnimationConfig,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, type Contestant, type Room, type RoomStatus } from '@/api';
import { Balloon } from '@/components/balloon';
import { Button } from '@/components/button';
import { ErrorLine } from '@/components/error-line';
import { LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import {
  Ease,
  Gutter,
  MaxContentWidth,
  Motion,
  PhotoAspect,
  Space,
  type Seat,
} from '@/constants/theme';
import { announce, Announcer, sentence } from '@/features/game/announce';
import { AnswerComposer, AnswerSent, SentAnswerCard } from '@/features/game/answer-composer';
import {
  AnswerCarousel,
  cardPhotoBox,
  cardWidthFor,
  ROOMY_CARD_WIDTH,
  type AnswerCarouselHandle,
} from '@/features/game/answer-carousel';
import { BalloonRail } from '@/features/game/balloon-rail';
import { LeaveSheet } from '@/features/game/leave-sheet';
import { LiveRow, PoppedRow } from '@/features/game/player-row';
import { afterBeatIn, PopNews } from '@/features/game/pop-news';
import { PoppedView } from '@/features/game/popped-view';
import { PopperPresence } from '@/features/game/popper-presence';
import { QuestionPicker } from '@/features/game/question-picker';
import { ResultBlock, resultLine } from '@/features/game/result-block';
import { RoomBar } from '@/features/game/room-bar';
import { LockLine, MY_PHOTO_FRAME, MyPhoto, QuestionBlock } from '@/features/game/room-blocks';
import { RoundTimer } from '@/features/game/round-timer';
import { usePopBeat } from '@/features/game/use-pop-beat';
import { useHardwareBack } from '@/hooks/use-hardware-back';
import { useRoom } from '@/hooks/use-server';
import { useTextScale } from '@/hooks/use-text-scale';
import { seatAt, useSeats, useTheme } from '@/hooks/use-theme';
import { haptics } from '@/utils/haptics';
import { goHome } from '@/utils/navigation';
import { nativeOnly, webSafeKeyframe } from '@/utils/web-motion';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useT, type Translate } from '@/i18n';

/** The Pop button's bar: its top padding, the button and the hairline, before the bottom inset. */
const POP_BAR = Space.sm + 56 + StyleSheet.hairlineWidth;
/**
 * In the final two, "Laura's balloon pops." under the button: its gap, then one
 * footnote line, which grows with the text size.
 */
const KEEPER_GAP = Space.xs;
const KEEPER_LINE = 18;
/**
 * Until they are measured, at the default text size: the room bar, and the
 * question block (kicker and two lines of question).
 */
const BAR_ESTIMATE = 160;
const QUESTION_ESTIMATE = 18 + 6 + 2 * 28;
/** "Choose whose balloon to pop": one headline line at the default text size. */
const CHOOSE_LINE = 20;
/**
 * The space around the popper's question and the answer cards under it: above the
 * question, above "Choose whose balloon to pop", above the cards, and kept clear
 * between the cards and the Pop bar. The canvas's spacing where a comfortable card
 * still fits under it. Where it doesn't (a 375 x 812 iPhone once its insets are
 * taken off), the tighter set gives the card that height back, so the whole card,
 * answer included, stays above the Pop bar. Smaller phones scroll instead.
 */
type RevealSpacing = { question: number; choose: number; cards: number; below: number };
const CANVAS_SPACING: RevealSpacing = { question: 20, choose: 14, cards: Space.sm - 2, below: Space.sm };
const TIGHT_SPACING: RevealSpacing = {
  question: Space.sm,
  choose: Space.xs,
  cards: Space.xs - 2,
  below: Space.xs,
};

/** A failed call, and the phase it was made in. Null for leave and replay: those stay until the next call. */
type CallError = { phase: string | null; message: string };

/** Renders nothing. While it is mounted, Android's back button runs `onBack` instead. */
function BackAsksToLeave({ onBack }: { onBack: () => void }) {
  useHardwareBack(onBack);
  return null;
}

function phaseLabel(t: Translate, status: Exclude<RoomStatus, 'finished'>) {
  switch (status) {
    case 'picking':
      return t('game.phasePicking');
    case 'answering':
      return t('game.phaseAnswering');
    case 'popping':
      return t('game.phasePopping');
  }
}

/** The phase a call is made in. Its error shows only while the room is still there. */
function phaseOf(room: Room) {
  return `${room.round}:${room.status}`;
}

function popLine(t: Translate, room: Room, popped: Contestant) {
  if (room.me.role === 'popper') return t('game.youPopped', { name: popped.name });
  if (popped.id === room.me.id) return t('game.poppedYours', { popper: room.popper.name });
  return t('game.poppedTheirs', { popper: room.popper.name, name: popped.name });
}

function lastBalloonLine(t: Translate, room: Room, keeper: Contestant | undefined) {
  if (!keeper) return undefined;
  return keeper.id === room.me.id
    ? t('game.yourLast')
    : t('game.theirLast', { name: keeper.name });
}

/** One key per revealed photo, so each new photo develops once. */
function photoKey(contestant: Contestant) {
  return `${contestant.id}:${contestant.photos.length}`;
}

/** The photos showing in the room right now. */
function shownPhotoKeys(room: Room) {
  if (room.status !== 'popping' && room.status !== 'finished') return [];
  return room.contestants.filter((c) => !c.popped && c.photos.length > 0).map(photoKey);
}

type Player = { contestant: Contestant; seat: Seat };

// Builders live at module scope, so a re-render never rebuilds them.
/**
 * A row sliding into the Popped group, or into its new place. Skipped under
 * Reduce Motion, and on web, where it would stretch a row that changes size.
 */
const cardTransition = nativeOnly(LinearTransition.duration(Motion.enter).easing(Ease.inOut));
/** The next phase arriving on the page: the picker, the question, the waiting line. */
const phaseIn = FadeIn.duration(Motion.state).easing(Ease.out).reduceMotion(ReduceMotion.Never);
const phaseOut = FadeOut.duration(Motion.exit).easing(Ease.out).reduceMotion(ReduceMotion.Never);
/**
 * The list fades as the picker or the cards take over. Native only: it holds rows
 * with their own entrances, which an exit on web would replay.
 */
const listOut = nativeOnly(phaseOut);
/**
 * The question waits until the picking phase has gone and the rows below have
 * moved into place, so it never lands on top of either.
 */
const questionIn = FadeIn.duration(Motion.state)
  .delay(Motion.enter)
  .easing(Ease.out)
  .reduceMotion(ReduceMotion.Never);
/** The pop button only exists once a balloon is marked. */
const popButtonIn = webSafeKeyframe(
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 8 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: Ease.out },
  }).duration(Motion.state),
);
const popButtonFade = FadeIn.duration(Motion.state)
  .easing(Ease.out)
  .reduceMotion(ReduceMotion.Never);

export function GameRoomScreen({ roomId }: { roomId: string }) {
  const theme = useTheme();
  const t = useT();
  const seats = useSeats();
  const insets = useSafeAreaInsets();
  const windowSize = useWindowDimensions();
  const textScale = useTextScale();
  const reduced = useReduceMotion();
  const room = useRoom(roomId);
  const { beat, matchInBeat, start: startBeat, cancel: cancelBeat } = usePopBeat(room);
  // Selections are derived from the room below, so a stale id never shows.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [sendingPop, setSendingPop] = useState(false);
  /** Drawn as popped while the pop is on its way, so the burst lands on the press. */
  const [pendingPopId, setPendingPopId] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  /** The last leave failed: the web's leave sheet shows that error, and no older one. */
  const [leaveFailed, setLeaveFailed] = useState(false);
  const [replaying, setReplaying] = useState(false);
  /**
   * You left this room on the way to another one. If joining the queue fails
   * after that, you stay on the popped view, with "Play another room" to retry.
   */
  const [leftForReplay, setLeftForReplay] = useState(false);
  const [error, setError] = useState<CallError | null>(null);
  // The answer draft lives here, so it survives the leave flow.
  // It belongs to one round and starts empty in the next.
  const [draft, setDraft] = useState({ round: 0, text: '' });
  /** Photos that have developed. Null until the room first loads. */
  const [developed, setDeveloped] = useState<ReadonlySet<string> | null>(null);
  /** The room bar's height, for sizing the answer cards to the screen. */
  const [barHeight, setBarHeight] = useState(0);
  /** The question block's height (kicker and question), per round: how much header the cards share the screen with. */
  const [questionBox, setQuestionBox] = useState<{ round: number; height: number } | null>(null);
  /** Where the answer cards start on the page, per round. */
  const [cardsTop, setCardsTop] = useState<{ round: number; y: number } | null>(null);
  /** The answer cards at least half in view, per round. The rail dims the others. */
  const [inView, setInView] = useState<{ round: number; ids: string[] } | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const carouselRef = useRef<AnswerCarouselHandle>(null);
  const questionY = useRef(0);
  // Where things are in the scroll, for the photo reveal.
  // Written and read in effects and event handlers only.
  const scrollY = useRef(0);
  const viewport = useRef(0);
  const cardsY = useRef<number | null>(null);
  const visibleCards = useRef<string[]>([]);
  const myPhotoBox = useRef<{ y: number; width: number } | null>(null);

  // Photos already out when the room loads (a reload) render still. Only the
  // ones revealed while you are here develop.
  if (room && developed === null) {
    setDeveloped(new Set(shownPhotoKeys(room)));
  }

  const matchId = room?.matchId ?? null;
  const matchAs = room?.me.role === 'popper' ? 'popper' : 'winner';
  useEffect(() => {
    if (!matchId) return;
    // Hold the room for a beat, so the last pop lands before the match fades in.
    const timer = setTimeout(() => {
      router.replace({
        pathname: '/match/[id]',
        params: { id: matchId, as: matchAs },
      });
    }, Motion.hold);
    return () => clearTimeout(timer);
  }, [matchId, matchAs]);

  // Every new phase starts at the top: the balloons, the pop and the next question.
  // Nobody asked for this scroll, so under Reduce Motion it jumps. An effect event
  // reads that setting, so turning it on or off doesn't scroll by itself.
  const round = room?.round;
  const status = room?.status;
  const scrollToTop = useEffectEvent(() => {
    scrollY.current = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: !reduced });
  });
  useEffect(() => {
    scrollToTop();
  }, [round, status]);
  // A pop jumps straight to the top, so its burst plays in view instead of
  // being over by the time an animated scroll gets there.
  const holdingId = beat?.holding ? beat.id : null;
  useEffect(() => {
    if (!holdingId) return;
    scrollY.current = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [holdingId]);

  // A failed answer, pick or pop belongs to its phase: once the room moves on it
  // would be wrong ("Couldn't send your answer." above the next round's empty box), so
  // it goes. A failed leave or replay stays until the next call.
  const shownError =
    error && room && (error.phase === null || error.phase === phaseOf(room))
      ? error.message
      : null;

  // VoiceOver has no live regions, so say failed calls out loud.
  useEffect(() => {
    if (shownError && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(shownError);
  }, [shownError]);

  // An Alert outlives the room: once the game ends or hands off, its Leave does nothing.
  const roomLive = useRef(true);
  const live = room != null && room.status !== 'finished';
  useEffect(() => {
    roomLive.current = live;
    return () => {
      roomLive.current = false;
    };
  }, [live]);

  if (room === undefined) return <LoadingScreen label={t('game.loadingRoom')} />;
  if (room === null) {
    return (
      <Screen
        scroll
        contentStyle={styles.center}
        footer={<Button title={t('game.backHome')} onPress={goHome} />}>
        <ThemedText themeColor="textSecondary" style={styles.centerText}>
          {t('game.roomGone')}
        </ThemedText>
      </Screen>
    );
  }

  const isPopper = room.me.role === 'popper';
  const myIndex = room.contestants.findIndex((c) => c.id === room.me.id);
  const me = myIndex >= 0 ? room.contestants[myIndex] : undefined;
  const iAmActive = !!me && !me.popped;
  const finished = room.status === 'finished';
  const isPopping = room.status === 'popping';
  const answering = room.status === 'answering';
  const pending = isPopping
    ? room.contestants.find((c) => c.id === pendingPopId && !c.popped)
    : undefined;
  const selected = isPopping
    ? room.contestants.find((c) => c.id === selectedId && !c.popped)
    : undefined;
  const selectedQuestion =
    room.status === 'picking'
      ? room.questionOptions.find((question) => question.id === questionId)
      : undefined;
  const winner = room.contestants.find((c) => c.id === room.winnerId);
  const canSelect = isPopper && isPopping && !sendingPop;

  // Hues follow the seat, so they stay the same when rows move.
  const players: Player[] = room.contestants.map((contestant, index) => ({
    contestant,
    seat: seatAt(seats, index),
  }));
  const seatOf = (contestant: Contestant) =>
    seatAt(
      seats,
      room.contestants.findIndex((c) => c.id === contestant.id),
    );
  const up = players.filter((player) => !player.contestant.popped);
  // The popped ones, most recent pop first.
  const down = players
    .filter((player) => player.contestant.popped)
    .sort((a, b) => (b.contestant.poppedInRound ?? 0) - (a.contestant.poppedInRound ?? 0));
  const finalTwo = !finished && up.length <= 2;
  const keeper =
    selected && up.length === 2
      ? up.find((player) => player.contestant.id !== selected.id)
      : undefined;

  // The beat: for Motion.hold after a pop, the room shows the pop before the next phase.
  // Your own pop is told by the popped view, so it never holds the room.
  const beatPop = beat ? room.contestants.find((c) => c.id === beat.id) : undefined;
  const holding = !!beat?.holding && !!beatPop && beatPop.id !== room.me.id;
  // The last pop of the game, seen live.
  const finalPopLive =
    finished &&
    !!beatPop?.popped &&
    beatPop.poppedInRound === room.round &&
    beatPop.id !== room.me.id;
  // The climax: the last pop stays on screen through its beat and, when the match
  // arrived during that beat, until the match opens. A match that arrives later
  // leaves the result on screen instead, so the top never flips back and forth.
  const climax = finalPopLive && (holding || (!!matchId && matchInBeat));
  // A pop holding the room: on the popper's press, or as the next round starts.
  const holdingPop = holding && !!beatPop && (room.status === 'picking' || !!pending);
  const pickingNow = room.status === 'picking' && !holding;
  // The popper's reveal: the answer cards, side by side.
  const revealing = isPopper && isPopping && !holdingPop;

  // The phase you pressed in, read now: by the time a call fails the room may have moved on.
  const phase = phaseOf(room);
  const popperName = room.popper.name;

  /**
   * Runs a call. Its error is tied to `phase`, or to none for leave and replay.
   * `failMessage` is said in the app's language, never the server's words.
   */
  async function call(action: () => Promise<void>, errorPhase: string | null, failMessage: string) {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError({ phase: errorPhase, message: failMessage });
      haptics.error();
      throw e;
    }
  }

  async function leave() {
    if (leaving) return;
    setLeaving(true);
    setLeaveFailed(false);
    try {
      await call(() => api.leaveRoom(roomId), null, t('game.leaveFailed'));
      goHome();
    } catch {
      // The error is shown above the footer, and in the web's leave sheet.
      setLeaveFailed(true);
      setLeaving(false);
    }
  }

  function confirmLeave() {
    if (!roomLive.current) return;
    haptics.medium();
    void leave();
  }

  const leaveMessage = isPopper
    ? t('game.leavePopper')
    : iAmActive
      ? t('game.leaveActive')
      : t('game.leaveWatching');

  function askLeave() {
    if (leaving || replaying) return;
    // Alert does nothing on the web, so the web confirms in a sheet instead.
    if (Platform.OS === 'web') {
      setLeaveFailed(false);
      setConfirmingLeave(true);
      return;
    }
    Alert.alert(t('game.leaveTitle'), leaveMessage, [
      { text: t('game.stay'), style: 'cancel' },
      { text: t('game.leave'), style: 'destructive', onPress: confirmLeave },
    ]);
  }

  async function playAgain() {
    if (replaying) return;
    setReplaying(true);
    try {
      await call(async () => {
        // A retry after the queue failed doesn't leave the room a second time.
        if (!leftForReplay) {
          await api.leaveRoom(roomId);
          setLeftForReplay(true);
        }
        await api.joinQueue();
      }, null, t('game.replayFailed'));
      router.replace('/queue');
    } catch {
      // The error is shown above the buttons.
      setReplaying(false);
    }
  }

  /** Keeps the question in view above the keyboard while you type your answer. */
  function showQuestion() {
    scrollRef.current?.scrollTo({
      y: Math.max(0, questionY.current - Space.xs),
      animated: !reduced,
    });
  }

  // The answer cards are as wide as the canvas's where the screen has room, and
  // narrower where it doesn't, so a whole card sits above the Pop button. The room
  // is measured as if that button showed, with the line under it in the final two,
  // so marking a card never resizes them.
  const pageWidth = Math.min(windowSize.width, MaxContentWidth);
  const revealRoom =
    windowSize.height -
    insets.top -
    (barHeight || BAR_ESTIMATE) -
    POP_BAR -
    (up.length === 2 ? KEEPER_GAP + KEEPER_LINE * textScale : 0) -
    Math.max(insets.bottom, Space.md);
  const questionHeight =
    questionBox?.round === room.round ? questionBox.height : QUESTION_ESTIMATE;
  const headerHeight = (spacing: RevealSpacing) =>
    spacing.question + questionHeight + spacing.choose + CHOOSE_LINE * textScale + spacing.cards;
  // Tightened when a comfortable card wouldn't fit under the canvas's spacing. Decided
  // from the question's height, which the spacing doesn't change, so it never flips
  // back and forth; and from the moment the question is asked, so the question
  // doesn't jump when the cards arrive.
  const tight =
    isPopper &&
    cardWidthFor(
      revealRoom - headerHeight(CANVAS_SPACING) - CANVAS_SPACING.below,
      pageWidth,
      textScale,
    ) < ROOMY_CARD_WIDTH;
  const spacing = tight ? TIGHT_SPACING : CANVAS_SPACING;
  // The cards fade in after the question, so a measure that corrects this lands before they show.
  const cardsAt = cardsTop?.round === room.round ? cardsTop.y : headerHeight(spacing);
  const cardWidth = cardWidthFor(revealRoom - cardsAt - spacing.below, pageWidth, textScale);
  const myPhotoShowing = !isPopper && isPopping && iAmActive && me.photos.length > 0;

  /**
   * Develops each new photo once at least half of it is in view, so the reveal
   * happens where the eye is: a card once it is half on screen in the carousel,
   * your own photo once you scroll to it. Only sets state when a photo crosses that line.
   */
  function developVisible() {
    // Before the first measure, the page as the window leaves it, so a photo never
    // waits on a layout event to show.
    const view = viewport.current || windowSize.height - insets.top - (barHeight || BAR_ESTIMATE);
    const top = scrollY.current;
    const bottom = top + view;
    const fresh: string[] = [];
    const consider = (key: string, photoTop: number, photoHeight: number) => {
      if (developed?.has(key)) return;
      const seen = Math.min(photoTop + photoHeight, bottom) - Math.max(photoTop, top);
      if (seen >= Math.min(photoHeight, view) / 2) fresh.push(key);
    };
    if (revealing) {
      const box = cardPhotoBox(cardWidth);
      const cardsStart = cardsY.current ?? cardsAt;
      for (const id of visibleCards.current) {
        const contestant = room?.contestants.find((c) => c.id === id);
        if (contestant && contestant.photos.length > 0) {
          consider(photoKey(contestant), cardsStart + box.top, box.height);
        }
      }
    }
    if (myPhotoShowing && myPhotoBox.current) {
      const { y, width } = myPhotoBox.current;
      consider(photoKey(me), y + MY_PHOTO_FRAME, (width - 2 * MY_PHOTO_FRAME) / PhotoAspect);
    }
    if (fresh.length === 0) return;
    setDeveloped((current) => {
      if (fresh.every((key) => current?.has(key))) return current;
      return new Set([...(current ?? []), ...fresh]);
    });
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    scrollY.current = contentOffset.y;
    viewport.current = layoutMeasurement.height;
    developVisible();
  }

  function handleCardsInView(ids: string[]) {
    visibleCards.current = ids;
    setInView({ round: room!.round, ids });
    developVisible();
  }

  function measureCards(event: LayoutChangeEvent) {
    const { y } = event.nativeEvent.layout;
    cardsY.current = y;
    if (cardsTop?.round !== room!.round || cardsTop.y !== y) {
      setCardsTop({ round: room!.round, y });
    }
    developVisible();
  }

  function measureMyPhoto(event: LayoutChangeEvent) {
    const { y, width } = event.nativeEvent.layout;
    myPhotoBox.current = { y, width };
    developVisible();
  }

  function selectQuestion(id: string) {
    if (asking) return;
    if (id !== selectedQuestion?.id) haptics.selection();
    setQuestionId(id);
  }

  async function handleAsk() {
    if (!selectedQuestion || asking) return;
    haptics.light();
    setAsking(true);
    try {
      await call(() => api.pickQuestion(roomId, selectedQuestion.id), phase, t('game.pickFailed'));
    } catch {
      // The error is shown above the button, and the pick stays marked.
    } finally {
      setAsking(false);
    }
  }

  async function sendAnswer(text: string) {
    await call(() => api.postAnswer(roomId, text), phase, t('game.answerFailed'));
    haptics.success();
    // The composer, with the Send button VoiceOver was on, gives way to the Sent line.
    // Queued, so the keyboard going down doesn't cut it off.
    announce(t('game.sent', { name: popperName }));
  }

  function selectBalloon(id: string) {
    if (!canSelect) return;
    if (id !== selected?.id) haptics.selection();
    setSelectedId(id);
  }

  /** A seat tapped in the room bar marks it and brings its card into view. */
  function selectFromRail(id: string) {
    selectBalloon(id);
    carouselRef.current?.scrollToCard(id);
  }

  async function handlePop() {
    if (!selected || sendingPop) return;
    const target = selected;
    // Only the popper pops, so this is the popper's own pop line.
    const announcement = t('game.youPopped', { name: target.name });
    // The pop is felt and seen on the press itself, and rolled back if the server says no.
    haptics.medium();
    setSendingPop(true);
    setPendingPopId(target.id);
    startBeat(target.id);
    try {
      await call(() => api.popBalloon(roomId, target.id), phase, t('game.popFailed'));
      setSelectedId(null);
      // Said once the server has it, so a pop that fails is never announced. Queued,
      // so the Pop bar VoiceOver was on going away doesn't cut it off.
      if (Platform.OS !== 'web') {
        AccessibilityInfo.announceForAccessibilityWithOptions(announcement, { queue: true });
      }
    } catch {
      cancelBeat(target.id);
    } finally {
      setPendingPopId(null);
      setSendingPop(false);
    }
  }

  const roundOf = t('game.roundOf', { round: room.round, total: room.totalRounds });
  const title = finished ? t('game.final') : finalTwo ? t('game.finalTwo') : roundOf;
  const left = (count: number) => t('game.balloonsLeft', { count });
  const yourPhotoShowing = me ? t('game.yourPhotoShowing', { n: me.photos.length }) : '';

  // Your own pop in the final, seen live: the room goes straight to the result.
  const ownFinalPop =
    finished && beatPop?.id === room.me.id && beatPop.poppedInRound === room.round;

  // Your balloon is out: the popped view takes the room's place until you stay to
  // watch, or the game ends.
  const viewer = isPopper ? 'popper' : room.winnerId === room.me.id ? 'winner' : 'other';

  const showPopped =
    !isPopper &&
    !!me?.popped &&
    (!me.left || replaying || leftForReplay) &&
    !watching &&
    !finished;

  /**
   * What the room just moved on to, in a sentence, for VoiceOver: the lines below
   * that Android reads from their live regions, and the question, which has none.
   * Quiet while a pop holds the room, because PopNews says the pop, and once you
   * are on your way out.
   */
  const spokenPhase = (): string | null => {
    if (holdingPop || climax || leaving || me?.left) return null;
    const question = room.question ? sentence(room.question.text) : '';
    switch (room.status) {
      case 'finished': {
        // The match opens on its own and says what happened.
        if (matchId) return null;
        const result = winner
          ? sentence(resultLine(t, viewer, popperName, winner.name))
          : `${sentence(t('game.endedEarly'))} ${t('game.noMatch')}`;
        return ownFinalPop
          ? `${sentence(t('game.poppedYours', { popper: popperName }))} ${result}`
          : result;
      }
      case 'picking':
        return isPopper
          ? `${title}. ${sentence(t('game.askSomething'))}`
          : `${title}. ${sentence(t('game.isPicking', { name: popperName }))}${room.round > 1 ? ` ${sentence(left(up.length))}` : ''}`;
      case 'answering':
        return isPopper
          ? `${t('game.youAskedSpoken', { question })} ${t('game.photosUnlock')}`
          : t('game.asksSpoken', { name: popperName, question });
      case 'popping':
        if (isPopper) {
          return room.popReminder
            ? t('game.waitingOnYou')
            : `${t('game.answersIn')} ${sentence(t('game.choosePop'))}`;
        }
        return `${sentence(t('game.isDeciding', { name: popperName }))}${myPhotoShowing ? ` ${yourPhotoShowing}` : ''}`;
    }
  };

  // iOS only: Android and the web have the live regions. One announcer in the same
  // place for the room and the popped view, so it keeps the last line it said: the
  // popped view says nothing about the room, and the room you stay to watch, or the
  // result once the game ends, is said as it takes over.
  const announcer = <Announcer text={showPopped ? null : spokenPhase()} />;
  // Android's back button asks first, like Leave, so it can't walk out of a live game.
  const backAsks = finished ? null : <BackAsksToLeave onBack={askLeave} />;

  if (showPopped && me) {
    return (
      <>
        {announcer}
        {backAsks}
        <PoppedView
          popperName={room.popper.name}
          round={me.poppedInRound}
          color={seatAt(seats, myIndex).color}
          fresh={beat?.id === me.id}
          replaying={replaying}
          error={shownError}
          onPlayAgain={playAgain}
          onWatch={() => {
            setConfirmingLeave(false);
            // The room comes back as it is now: photos already out don't develop again.
            setDeveloped((current) => new Set([...(current ?? []), ...shownPhotoKeys(room)]));
            setWatching(true);
          }}
        />
      </>
    );
  }

  // The top of the page while a pop holds the room: the burst, the line and what is left.
  let news: ReactNode = null;
  if (climax && beatPop) {
    // A match is on its way: keep the last pop on screen until it fades in.
    news = (
      <PopNews
        key={beatPop.id}
        text={popLine(t, room, beatPop)}
        detail={lastBalloonLine(t, room, winner)}
        color={seatOf(beatPop).color}
        animate={holding}
        announce={!isPopper}
      />
    );
  } else if (holdingPop && beatPop) {
    const stillUp = up.length - (pending ? 1 : 0);
    const lastOne =
      pending && stillUp === 1 ? up.find((p) => p.contestant.id !== pending.id) : undefined;
    news = (
      <PopNews
        key={beatPop.id}
        text={popLine(t, room, beatPop)}
        detail={lastOne ? lastBalloonLine(t, room, lastOne.contestant) : left(stillUp)}
        color={seatOf(beatPop).color}
        animate
        announce={!isPopper}
      />
    );
  }
  const showResult = finished && !climax;

  // The question, and what the room is waiting on under it. Keyed by which line it
  // is, so a new line arrives with the question, after the rows move.
  const showQuestionBlock = !!room.question && (answering || (isPopping && !holdingPop));
  const myAnswer = answering && iAmActive && me.answered ? me.answer : null;
  let statusLine: ReactNode = null;
  let statusKey = 'none';
  let statusStyle = styles.afterQuestion;
  if (showQuestionBlock && answering) {
    statusKey = 'answering';
    statusStyle = myAnswer ? styles.afterAnswer : styles.afterQuestion;
    statusLine = <LockLine />;
  } else if (showQuestionBlock && isPopper) {
    statusKey = 'choose';
    statusStyle = tight ? styles.chooseLineTight : styles.chooseLine;
    statusLine = (
      <ThemedText type="headline" accessibilityRole="header" accessibilityLiveRegion="polite">
        {room.popReminder ? t('game.waitingOnYou') : t('game.choosePop')}
      </ThemedText>
    );
  } else if (showQuestionBlock) {
    statusKey = 'deciding';
    statusLine = (
      <ThemedText type="footnote" themeColor="textSecondary" accessibilityLiveRegion="polite">
        {t('game.isDeciding', { name: room.popper.name })}…
        {myPhotoShowing ? ` ${yourPhotoShowing}` : ''}
      </ThemedText>
    );
  }

  // Who is still in, then who has popped. A pop on its way already counts as popped.
  // One keyed list, so a popped row slides down to the popped ones and the
  // others slide up into its place instead of jumping.
  const showList = !showResult && !(isPopper && pickingNow) && !revealing;
  const stillIn = up.filter((player) => player.contestant.id !== pending?.id);
  const pendingPlayer = pending ? up.find((p) => p.contestant.id === pending.id) : undefined;
  const popped = pendingPlayer ? [pendingPlayer, ...down] : down;
  const rows: ReactNode[] = stillIn.map(({ contestant, seat }) => (
    <Animated.View key={contestant.id} layout={cardTransition}>
      <LiveRow
        contestant={contestant}
        color={seat.color}
        isMe={contestant.id === room.me.id}
        status={isPopper && answering ? (contestant.answered ? 'answered' : 'writing') : undefined}
      />
    </Animated.View>
  ));
  if (popped.length > 0) {
    rows.push(
      <Animated.View key="popped-header" layout={cardTransition} style={styles.poppedHeader}>
        <ThemedText type="footnote" themeColor="textSecondary" accessibilityRole="header">
          {t('game.popped')}
        </ThemedText>
      </Animated.View>,
    );
  }
  rows.push(
    ...popped.map(({ contestant, seat }, index) => (
      <Animated.View key={contestant.id} layout={cardTransition}>
        <PoppedRow
          contestant={contestant}
          color={seat.color}
          isMe={contestant.id === room.me.id}
          round={contestant.poppedInRound ?? (contestant.id === pending?.id ? room.round : null)}
          last={index === popped.length - 1}
        />
      </Animated.View>
    )),
  );
  // The list sits a step further from the pop news than from a quiet line. For
  // contestants the popper's block sits between the news and the list.
  const listStyle =
    news && (isPopper || finished)
      ? styles.listAfterNews
      : (!isPopper && pickingNow) || myAnswer
        ? styles.listAfterLine
        : styles.list;

  // From round 2 on, the picking phase arrives as a beat ends: it waits for the pop news to fade.
  const pickingIn = room.round > 1 ? afterBeatIn : phaseIn;

  let footer: ReactNode = null;
  if (finished) {
    // While the last pop holds the room, nothing should pull you off this moment.
    footer = climax ? null : <Button title={t('game.backHome')} onPress={goHome} />;
  } else if (iAmActive && answering) {
    footer = me.answered ? (
      <AnswerSent popperName={room.popper.name} />
    ) : (
      <AnswerComposer
        value={draft.round === room.round ? draft.text : ''}
        onChangeText={(text) => setDraft({ round: room.round, text })}
        onSend={sendAnswer}
        onFocus={showQuestion}
        popperName={room.popper.name}
      />
    );
  } else if (isPopper && pickingNow) {
    footer = (
      <Animated.View entering={pickingIn}>
        <Button
          title={t('game.askThis')}
          disabled={!selectedQuestion}
          loading={asking}
          onPress={handleAsk}
        />
      </Animated.View>
    );
  } else if (isPopper && isPopping && selected && !pending) {
    // Gone the moment you press it: the pop is already happening at the top.
    // The balloon on it is the one that stays in the final two, the one that pops before.
    const shown = keeper ? keeper.seat : seatOf(selected);
    footer = (
      <Animated.View entering={reduced ? popButtonFade : popButtonIn} style={styles.popFooter}>
        <Button
          title={
            keeper
              ? t('game.matchWith', { name: keeper.contestant.name })
              : t('game.popBalloon', { name: selected.name })
          }
          icon={<Balloon color={shown.onInk} size={14} string={false} shine={false} />}
          accessibilityHint={keeper ? t('game.popsHint', { name: selected.name }) : undefined}
          onPress={handlePop}
        />
        {keeper ? (
          <ThemedText type="footnote" themeColor="textSecondary" style={styles.centerText}>
            {t('game.balloonPops', { name: selected.name })}
          </ThemedText>
        ) : null}
      </Animated.View>
    );
  }
  const hasFooter = !!footer || !!shownError;

  const subtitle = finished
    ? winner
      ? t('game.roundsPlayed', { count: room.round })
      : t('game.endedEarlyShort')
    : phaseLabel(t, room.status as Exclude<RoomStatus, 'finished'>);

  return (
    <>
      {announcer}
      {backAsks}
      {/* Whatever is already there when the room opens renders still, and nothing
          fades out when the room itself goes away. Only changes animate. */}
      <LayoutAnimationConfig skipEntering skipExiting>
        <View style={styles.flex}>
          <Screen
            contentStyle={styles.content}
            // The result floats its button on the page, like the match; every live phase
            // keeps its action on a bar, with content running on beneath it.
            footerStyle={finished ? 'plain' : 'bar'}
            footer={
              hasFooter ? (
                <>
                  {shownError ? <ErrorLine message={shownError} /> : null}
                  {footer}
                </>
              ) : undefined
            }>
            <RoomBar
              title={title}
              titleLabel={
                finalTwo
                  ? t('game.finalTwoLabel', { round: room.round, total: room.totalRounds })
                  : undefined
              }
              subtitle={subtitle}
              watching={watching && !finished}
              timer={
                answering || isPopping ? (
                  <RoundTimer deadline={room.deadline} popReminder={room.popReminder} />
                ) : null
              }
              onLeave={finished ? undefined : askLeave}
              leaving={leaving}
              rounds={{
                total: room.totalRounds,
                filled: Math.min(room.round, room.totalRounds),
                label: finished
                  ? t('game.roundsPlayedOf', { round: room.round, total: room.totalRounds })
                  : roundOf,
              }}
              rail={
                <BalloonRail
                  contestants={room.contestants}
                  meId={room.me.id}
                  markedId={pending ? null : (selected?.id ?? null)}
                  poppingId={pending?.id ?? null}
                  risenId={finished ? room.winnerId : null}
                  inView={revealing && inView?.round === room.round ? inView.ids : null}
                  onSelect={canSelect && revealing ? selectFromRail : undefined}
                />
              }
              onLayout={(event) => {
                const { height } = event.nativeEvent.layout;
                if (height !== barHeight) setBarHeight(height);
              }}
            />

            <ScrollView
              ref={scrollRef}
              style={styles.flex}
              contentContainerStyle={[
                styles.scroll,
                {
                  paddingBottom: hasFooter ? Space.xl : insets.bottom + Space.xl,
                },
              ]}
              onScroll={handleScroll}
              onLayout={(event) => {
                viewport.current = event.nativeEvent.layout.height;
                developVisible();
              }}
              scrollEventThrottle={32}
              keyboardShouldPersistTaps="handled"
              // On web a click starts a scroll gesture, so any dismiss mode would blur the answer field.
              // On-drag rather than interactive: the footer can't follow an interactive drag.
              keyboardDismissMode={Platform.select({
                ios: 'on-drag',
                android: 'on-drag',
                default: 'none',
              })}>
              {news}

              {showResult ? (
                <View style={styles.result}>
                  <ResultBlock
                    popper={room.popper}
                    winner={winner}
                    winnerTone={winner ? seatOf(winner) : undefined}
                    rounds={room.round}
                    viewer={viewer}
                  />
                </View>
              ) : null}

              {!isPopper && !finished ? (
                <View style={news ? styles.presenceAfterNews : styles.presence}>
                  <PopperPresence popper={room.popper} />
                </View>
              ) : null}

              {pickingNow ? (
                isPopper ? (
                  // No exit fade: the question moves up into the picker's place at once,
                  // and would be drawn over its fading options. Your tap explains the change.
                  <Animated.View key="picker" entering={pickingIn} style={styles.first}>
                    <QuestionPicker
                      options={room.questionOptions}
                      selectedId={selectedQuestion?.id ?? null}
                      onSelect={selectQuestion}
                      locked={asking}
                      answering={up.length}
                    />
                  </Animated.View>
                ) : (
                  <Animated.View
                    key="picking"
                    entering={pickingIn}
                    exiting={phaseOut}
                    style={styles.pickingLine}>
                    <ThemedText
                      type="footnote"
                      themeColor="textSecondary"
                      accessibilityLiveRegion="polite">
                      {t('game.isPicking', { name: room.popper.name })}…
                      {room.round > 1 ? ` ${sentence(left(up.length))}` : ''}
                    </ThemedText>
                  </Animated.View>
                )
              ) : null}

              {showQuestionBlock && room.question ? (
                <View
                  style={tight ? styles.questionTight : styles.question}
                  onLayout={(event) => {
                    const { y, height } = event.nativeEvent.layout;
                    questionY.current = y;
                    if (questionBox?.round !== room.round || questionBox.height !== height) {
                      setQuestionBox({ round: room.round, height });
                    }
                  }}>
                  <Animated.View entering={questionIn}>
                    <QuestionBlock
                      kicker={isPopper ? t('game.youAsked') : t('game.asks', { name: room.popper.name })}
                      text={room.question.text}
                    />
                  </Animated.View>
                </View>
              ) : null}

              {myAnswer ? (
                <View style={styles.myAnswer}>
                  <SentAnswerCard text={myAnswer} />
                </View>
              ) : null}

              {statusLine ? (
                <Animated.View key={statusKey} entering={questionIn} style={statusStyle}>
                  {statusLine}
                </Animated.View>
              ) : null}

              {myPhotoShowing ? (
                <View key="my-photo" style={styles.myPhoto} onLayout={measureMyPhoto}>
                  <Animated.View entering={questionIn}>
                    <MyPhoto
                      uri={me.photos[me.photos.length - 1]}
                      name={me.name}
                      tone={seatAt(seats, myIndex)}
                      position={me.photos.length}
                      developed={!!developed?.has(photoKey(me))}
                    />
                  </Animated.View>
                </View>
              ) : null}

              {revealing ? (
                // The cards run edge to edge, so the next one peeks in from the side.
                <View
                  key="cards"
                  style={[styles.cards, tight && styles.cardsTight]}
                  onLayout={measureCards}>
                  <Animated.View entering={questionIn}>
                    <AnswerCarousel
                      ref={carouselRef}
                      cards={up.map(({ contestant, seat }) => ({
                        contestant,
                        seat,
                        developed: !!developed?.has(photoKey(contestant)),
                      }))}
                      width={cardWidth}
                      markedId={selected?.id ?? null}
                      onSelect={canSelect ? selectBalloon : undefined}
                      onVisibleChange={handleCardsInView}
                    />
                  </Animated.View>
                </View>
              ) : null}

              {showList ? (
                <Animated.View
                  exiting={listOut}
                  style={[
                    listStyle,
                    {
                      borderTopColor: theme.border,
                      borderTopWidth: StyleSheet.hairlineWidth,
                    },
                  ]}>
                  {rows}
                </Animated.View>
              ) : null}
            </ScrollView>
          </Screen>
          {/* The web's leave confirmation, over the whole room. iOS and Android use Alert. */}
          {Platform.OS === 'web' && confirmingLeave && !finished ? (
            <LeaveSheet
              message={leaveMessage}
              leaving={leaving}
              error={leaveFailed ? shownError : null}
              onLeave={confirmLeave}
              onStay={() => setConfirmingLeave(false)}
            />
          ) : null}
        </View>
      </LayoutAnimationConfig>
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.lg,
  },
  centerText: {
    textAlign: 'center',
  },
  flex: {
    flex: 1,
  },
  /** The room bar and the scroll handle their own gutters. */
  content: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  scroll: {
    paddingHorizontal: Gutter,
  },
  /** The first block under the room bar. */
  first: {
    marginTop: 20,
  },
  result: {
    paddingTop: Space.xl,
  },
  presence: {
    marginTop: Space.md,
  },
  presenceAfterNews: {
    marginTop: Space.lg,
  },
  pickingLine: {
    marginTop: Space.md,
  },
  question: {
    marginTop: CANVAS_SPACING.question,
  },
  questionTight: {
    marginTop: TIGHT_SPACING.question,
  },
  myAnswer: {
    marginTop: Space.md,
  },
  afterQuestion: {
    marginTop: 10,
  },
  afterAnswer: {
    marginTop: Space.sm,
  },
  chooseLine: {
    marginTop: CANVAS_SPACING.choose,
  },
  chooseLineTight: {
    marginTop: TIGHT_SPACING.choose,
  },
  myPhoto: {
    marginTop: 14,
  },
  /** Edge to edge; the carousel keeps 2pt above its cards for the marked ring. */
  cards: {
    marginTop: CANVAS_SPACING.cards,
    marginHorizontal: -Gutter,
  },
  cardsTight: {
    marginTop: TIGHT_SPACING.cards,
  },
  list: {
    marginTop: Space.md,
  },
  listAfterLine: {
    marginTop: Space.sm,
  },
  listAfterNews: {
    marginTop: Space.lg,
  },
  /** A new group: more space above the heading than below it. */
  poppedHeader: {
    marginTop: Space.md,
  },
  popFooter: {
    gap: Space.xs,
  },
});
