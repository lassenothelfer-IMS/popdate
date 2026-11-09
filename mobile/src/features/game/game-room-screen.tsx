import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { LayoutAnimationConfig } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, type Contestant, type Room } from '@/api';
import { ErrorLine } from '@/components/error-line';
import { LoadingScreen } from '@/components/loading-screen';
import { Screen } from '@/components/screen';
import { Gutter, MaxContentWidth, Space } from '@/constants/theme';
import { announce, Announcer } from '@/features/game/announce';
import { usePersonActions, type Person } from '@/features/chat/person-actions';
import { LeaveSheet } from '@/features/game/leave-sheet';
import { PickingView } from '@/features/game/picking-view';
import { PlayerList } from '@/features/game/player-list';
import { afterBeatIn } from '@/features/game/pop-news';
import { PoppedView } from '@/features/game/popped-view';
import { PopperPresence } from '@/features/game/popper-presence';
import { ResultBlock } from '@/features/game/result-block';
import { QuestionSection } from '@/features/game/question-section';
import { RoomFooter } from '@/features/game/room-footer';
import { RoomHeader, roomTitle } from '@/features/game/room-header';
import { phaseIn } from '@/features/game/room-motion';
import { RoomNews } from '@/features/game/room-news';
import { roomPhase } from '@/features/game/room-phase';
import { roomSeatIndex } from '@/features/game/room-seats';
import { spokenPhase } from '@/features/game/room-speech';
import { RoomGone, RoomSlow } from '@/features/game/room-states';
import { BAR_ESTIMATE, revealLayout } from '@/features/game/reveal-layout';
import { RevealSection } from '@/features/game/reveal-section';
import { usePhotoDevelop } from '@/features/game/use-photo-develop';
import { usePopBeat } from '@/features/game/use-pop-beat';
import { phaseOf, useRoomCall } from '@/features/game/use-room-call';
import { BackAsksToLeave, useRoomExit } from '@/features/game/use-room-exit';
import { useMatchHandoff, useRoomSlow } from '@/features/game/use-room-timers';
import { useRoom } from '@/hooks/use-server';
import { useTextScale } from '@/hooks/use-text-scale';
import { seatAt, useSeats } from '@/hooks/use-theme';
import { track, type RoomOutcome } from '@/utils/analytics';
import { haptics } from '@/utils/haptics';
import { numberWord } from '@/utils/number-word';
import { countRoomPlayed, useShowHints } from '@/utils/rooms-played';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useT } from '@/i18n';

/** Milliseconds since `at`. Only for handlers and effects, never during render. */
function msSince(at: number) {
  return Date.now() - at;
}

/** Whether your own balloon has popped. */
function iPopped(room: Room) {
  return room.contestants.some((c) => c.id === room.me.id && c.popped);
}

/** How the room ended for you, once it has: for analytics. */
function roomOutcome(room: Room): RoomOutcome {
  if (room.me.role === 'popper') return room.winnerId ? 'chose' : 'ended';
  if (iPopped(room)) return 'popped';
  return room.winnerId === room.me.id ? 'won' : 'ended';
}

export function GameRoomScreen({ roomId }: { roomId: string }) {
  const t = useT();
  const seats = useSeats();
  const insets = useSafeAreaInsets();
  const windowSize = useWindowDimensions();
  const textScale = useTextScale();
  const reduced = useReduceMotion();
  const room = useRoom(roomId);
  const { beat, matchInBeat, holdMs, start: startBeat, cancel: cancelBeat } = usePopBeat(room);
  const showHints = useShowHints();
  // A room that won't load in a while: say so and offer a retry, rather than spin forever.
  const slow = useRoomSlow(room);
  // Report or block anyone in the room; nothing to leave on, the room carries on.
  const people = usePersonActions();
  // Selections are derived from the room below, so a stale id never shows.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [sendingPop, setSendingPop] = useState(false);
  /** Drawn as popped while the pop is on its way, so the burst lands on the press. */
  const [pendingPopId, setPendingPopId] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  // The answer draft lives here, so it survives the leave flow.
  // It belongs to one round and starts empty in the next.
  const [draft, setDraft] = useState({ round: 0, text: '' });
  /** The room bar's height, for sizing the answer cards to the screen. */
  const [barHeight, setBarHeight] = useState(0);
  /** The question block's height (kicker and question), per round: how much header the cards share the screen with. */
  const [questionBox, setQuestionBox] = useState<{ round: number; height: number } | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const questionY = useRef(0);
  const photos = usePhotoDevelop(room);
  const { scrollYRef, cardsYRef } = photos;

  // The marked balloon belongs to one phase. When the server pops for the chooser,
  // or the round moves on, it goes, so the next pop starts fresh.
  const phaseKey = room ? `${room.round}:${room.status}` : null;
  const [markedIn, setMarkedIn] = useState(phaseKey);
  if (phaseKey !== markedIn) {
    setMarkedIn(phaseKey);
    setSelectedId(null);
  }

  const { call, shownError } = useRoomCall(room);
  const exit = useRoomExit(
    roomId,
    room != null && room.status !== 'finished',
    call,
    // Only while you are still in: leaving after your balloon popped isn't leaving mid-game.
    room && !iPopped(room) ? { role: room.me.role, round: room.round } : null,
  );
  const { leaving, replaying } = exit;

  // Everything the room shows, from the room and what you have pressed.
  const phase = room
    ? roomPhase({
        room,
        beat,
        matchInBeat,
        selectedId,
        questionId,
        pendingPopId,
        sendingPop,
        watching,
        replaying,
        leftForReplay: exit.leftForReplay,
      })
    : null;

  useMatchHandoff(room, matchInBeat, holdMs);

  // Every new phase starts at the top: the balloons, the pop and the next question.
  // Nobody asked for this scroll, so under Reduce Motion it jumps. An effect event
  // reads that setting, so turning it on or off doesn't scroll by itself.
  const round = room?.round;
  const status = room?.status;
  const scrollToTop = useEffectEvent(() => {
    scrollYRef.current = 0;
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
    scrollYRef.current = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    // The ref is the same object every render: listed only for the linter.
  }, [holdingId, scrollYRef]);

  // For analytics: when this round's photos came out, so the chooser's pop can say how long it took.
  const poppingSince = useRef<{ round: number; at: number } | null>(null);
  useEffect(() => {
    poppingSince.current = status === 'popping' && round !== undefined ? { round, at: Date.now() } : null;
  }, [round, status]);

  // For analytics: whether you answered, sent once a round's answer time is over.
  const answerRound = useRef<{ round: number; answered: boolean } | null>(null);
  useEffect(() => {
    if (!room) return;
    const mine = room.contestants.find((c) => c.id === room.me.id);
    const last = answerRound.current;
    if (last && (room.status !== 'answering' || room.round !== last.round)) {
      // The last answer in ends the phase at once, so the room after it is the one that knows.
      const answeredNow = room.round === last.round && !!mine?.answered;
      track('round_answered', { round: last.round, answered: last.answered || answeredNow });
      answerRound.current = null;
    }
    if (room.status === 'answering' && mine && !mine.popped) {
      answerRound.current = { round: room.round, answered: mine.answered };
    }
  }, [room]);

  // One more room played once it ends for you: the game is over, or your balloon popped.
  // Hints only show during your first rooms.
  const endedForMe = !!phase?.endedForMe;
  const role = room?.me.role;
  const outcome = room && endedForMe ? roomOutcome(room) : null;
  const counted = useRef(false);
  useEffect(() => {
    if (!role || !outcome || counted.current) return;
    counted.current = true;
    void countRoomPlayed();
    track('room_finished', { role, outcome });
  }, [role, outcome]);

  if (room === undefined && slow) return <RoomSlow roomId={roomId} />;
  if (room === undefined) return <LoadingScreen label={t('game.loadingRoom')} />;
  if (room === null || !phase) return <RoomGone />;

  const { isPopper, myIndex, me, iAmActive, finished, answering } = phase;
  const { pending, selected, selectedQuestion, winner, canSelect, up, revealing } = phase;
  const othersInRoom: Person[] = [room.popper, ...room.contestants]
    .filter((player) => player.id !== room.me.id)
    .map((player) => ({ id: player.id, name: player.name, age: player.age }));

  // Hues follow the seat, so they stay the same when rows move.
  const seatOf = (contestant: Contestant) =>
    seatAt(
      seats,
      roomSeatIndex(
        room.contestants,
        room.contestants.findIndex((c) => c.id === contestant.id),
        room.me.id,
      ),
    );

  // The phase you pressed in, read now: by the time a call fails the room may have moved on.
  const pressedIn = phaseOf(room);
  const popperName = room.popper.name;

  const leaveMessage = isPopper
    ? t('game.leavePopper', { people: numberWord(t, up.length) })
    : iAmActive
      ? t('game.leaveActive')
      : t('game.leaveWatching');
  const askLeave = () => exit.askLeave(leaveMessage);
  const playAgain = () => void exit.playAgain();

  /** Keeps the question in view above the keyboard while you type your answer. */
  function showQuestion() {
    scrollRef.current?.scrollTo({
      y: Math.max(0, questionY.current - Space.xs),
      animated: !reduced,
    });
  }

  const { tight, cardsAt, cardWidth } = revealLayout({
    isPopper,
    window: windowSize,
    insets,
    barHeight,
    questionHeight: questionBox?.round === room.round ? questionBox.height : null,
    cardsTop: photos.cardsTop,
    upCount: up.length,
    showHints,
    textScale,
    pageWidth: Math.min(windowSize.width, MaxContentWidth),
  });

  // Develops each new photo once at least half of it is in view.
  const develop = photos.handlers({
    room,
    revealing,
    cardWidth,
    cardsAt,
    myPhoto: phase.myPhotoShowing && me ? me : null,
    fallbackViewport: windowSize.height - insets.top - (barHeight || BAR_ESTIMATE),
  });

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
      await call(() => api.pickQuestion(roomId, selectedQuestion.id), pressedIn, t('game.pickFailed'));
    } catch {
      // The error is shown above the button, and the pick stays marked.
    } finally {
      setAsking(false);
    }
  }

  async function sendAnswer(text: string) {
    await call(() => api.postAnswer(roomId, text), pressedIn, t('game.answerFailed'));
    haptics.success();
    // The composer, with the Send button VoiceOver was on, gives way to the Sent line.
    // Queued, so the keyboard going down doesn't cut it off.
    announce(t('game.sent', { name: popperName }));
  }

  /**
   * Marks a balloon, from its card or its seat in the room bar. The carousel brings
   * the marked card into view; if the page is scrolled past the cards, it comes back up to them.
   */
  function selectBalloon(id: string) {
    if (!canSelect) return;
    if (id !== selected?.id) haptics.selection();
    setSelectedId(id);
    const top = cardsYRef.current;
    if (top !== null && scrollYRef.current > top) {
      scrollYRef.current = top;
      scrollRef.current?.scrollTo({ y: top, animated: !reduced });
    }
  }

  async function handlePop(target: Contestant | undefined = selected) {
    if (!target || sendingPop) return;
    // Only the popper pops, so this is the popper's own pop line.
    const announcement = t('game.youPopped', { name: target.name });
    // The pop is seen the moment it goes out (its haptic plays with the burst), and
    // rolled back if the server says no.
    setSendingPop(true);
    setPendingPopId(target.id);
    startBeat(target.id);
    try {
      await call(() => api.popBalloon(roomId, target.id), pressedIn, t('game.popFailed'));
      const since = poppingSince.current;
      if (since) track('round_popped', { round: since.round, msToPop: msSince(since.at) });
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

  const title = roomTitle(t, room, phase);
  const yourPhotoShowing = me ? t('game.yourPhotoShowing', { n: me.photos.length }) : '';

  // iOS only: Android and the web have the live regions. One announcer in the same
  // place for the room and the popped view, so it keeps the last line it said: the
  // popped view says nothing about the room, and the room you stay to watch, or the
  // result once the game ends, is said as it takes over.
  const announcer = (
    <Announcer
      text={
        phase.showPopped
          ? null
          : spokenPhase(t, room, phase, { title, leaving, myPhotoLine: yourPhotoShowing })
      }
    />
  );
  // Android's back button asks first, like Leave, so it can't walk out of a live game.
  const backAsks = finished ? null : <BackAsksToLeave onBack={askLeave} />;

  if (phase.view === 'popped' && me) {
    return (
      <>
        {announcer}
        {backAsks}
        <PoppedView
          popperName={room.popper.name}
          round={me.poppedInRound}
          color={seatAt(seats, roomSeatIndex(room.contestants, myIndex, room.me.id)).color}
          fresh={beat?.id === me.id}
          replaying={replaying}
          error={shownError}
          onPlayAgain={exit.playAgain}
          onWatch={() => {
            exit.setConfirmingLeave(false);
            // The room comes back as it is now: photos already out don't develop again.
            photos.keepShown(room);
            setWatching(true);
          }}
        />
      </>
    );
  }

  const { beatPop, news, myAnswer } = phase;
  // The list sits a step further from the pop news than from a quiet line. For
  // contestants the popper's block sits between the news and the list.
  const listStyle =
    news && (isPopper || finished)
      ? styles.listAfterNews
      : (!isPopper && phase.pickingNow) || myAnswer
        ? styles.listAfterLine
        : styles.list;

  // From round 2 on, the picking phase arrives as a beat ends: it waits for the pop news to fade.
  const pickingIn = room.round > 1 ? afterBeatIn : phaseIn;

  const footer = phase.footer ? (
    <RoomFooter
      kind={phase.footer}
      roomId={roomId}
      popperName={popperName}
      deadline={room.deadline}
      showHints={showHints}
      replaying={replaying}
      onPlayAgain={playAgain}
      draft={draft.round === room.round ? draft.text : ''}
      onChangeDraft={(text) => setDraft({ round: room.round, text })}
      onSend={sendAnswer}
      onFocusAnswer={showQuestion}
      canAsk={!!selectedQuestion}
      asking={asking}
      onAsk={handleAsk}
      askEntering={pickingIn}
      up={up}
      selected={selected}
      selectedColor={selected ? seatOf(selected).shadow : undefined}
      onPop={(target) => void handlePop(target)}
    />
  ) : null;
  const hasFooter = !!footer || !!shownError;

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
            <RoomHeader
              room={room}
              phase={phase}
              watching={watching}
              leaving={leaving}
              inView={photos.inView}
              onLeave={askLeave}
              onMore={() => void people.openAmong(othersInRoom)}
              onSelect={selectBalloon}
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
              onScroll={develop.onScroll}
              onLayout={develop.onScrollLayout}
              scrollEventThrottle={32}
              keyboardShouldPersistTaps="handled"
              // On web a click starts a scroll gesture, so any dismiss mode would blur the answer field.
              // On-drag rather than interactive: the footer can't follow an interactive drag.
              keyboardDismissMode={Platform.select({
                ios: 'on-drag',
                android: 'on-drag',
                default: 'none',
              })}>
              {news && beatPop ? (
                <RoomNews
                  key={beatPop.id}
                  kind={news}
                  room={room}
                  popped={beatPop}
                  color={seatOf(beatPop).color}
                  winner={winner}
                  up={up}
                  pending={pending}
                  holding={phase.holding}
                  fromBurst={!!beat?.own}
                />
              ) : null}

              {phase.showResult ? (
                <View style={styles.result}>
                  <ResultBlock
                    popper={room.popper}
                    winner={winner}
                    winnerTone={winner ? seatOf(winner) : undefined}
                    rounds={room.round}
                    viewer={phase.viewer}
                  />
                </View>
              ) : null}

              {!isPopper && !finished ? (
                <View style={news ? styles.presenceAfterNews : styles.presence}>
                  <PopperPresence popper={room.popper} />
                </View>
              ) : null}

              {phase.pickingNow ? (
                <PickingView
                  isPopper={isPopper}
                  popperName={popperName}
                  round={room.round}
                  options={room.questionOptions}
                  selectedId={selectedQuestion?.id ?? null}
                  onSelect={selectQuestion}
                  asking={asking}
                  upCount={up.length}
                  entering={pickingIn}
                />
              ) : null}

              <QuestionSection
                room={room}
                phase={phase}
                showHints={showHints}
                tight={tight}
                myPhotoLine={yourPhotoShowing}
                onQuestionLayout={(event) => {
                  const { y, height } = event.nativeEvent.layout;
                  questionY.current = y;
                  if (questionBox?.round !== room.round || questionBox.height !== height) {
                    setQuestionBox({ round: room.round, height });
                  }
                }}
              />

              <RevealSection
                myPhoto={phase.myPhotoShowing && me ? me : null}
                revealing={revealing}
                up={up}
                seatOf={seatOf}
                developed={photos.developed}
                cardWidth={cardWidth}
                tight={tight}
                markedId={selected?.id ?? null}
                onSelect={canSelect ? selectBalloon : undefined}
                onCardsInView={develop.onCardsInView}
                onCardsLayout={develop.onCardsLayout}
                onMyPhotoLayout={develop.onMyPhotoLayout}
              />

              {phase.showList ? (
                <PlayerList
                  stillIn={phase.stillIn}
                  popped={phase.poppedRows}
                  seatOf={seatOf}
                  meId={room.me.id}
                  round={room.round}
                  pendingId={pending?.id ?? null}
                  showAnswered={answering}
                  style={listStyle}
                />
              ) : null}
            </ScrollView>
          </Screen>
          {/* The web's leave confirmation, over the whole room. iOS and Android use Alert. */}
          {Platform.OS === 'web' && exit.confirmingLeave && !finished ? (
            <LeaveSheet
              message={leaveMessage}
              leaving={leaving}
              error={exit.leaveFailed ? shownError : null}
              onLeave={exit.confirmLeave}
              onStay={() => exit.setConfirmingLeave(false)}
            />
          ) : null}
          {people.element}
        </View>
      </LayoutAnimationConfig>
    </>
  );
}

const styles = StyleSheet.create({
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
  result: {
    paddingTop: Space.xl,
  },
  presence: {
    marginTop: Space.md,
  },
  presenceAfterNews: {
    marginTop: Space.lg,
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
});
