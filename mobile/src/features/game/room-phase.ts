import type { Contestant, Question, Room } from '@/api/types';

/** The last pop seen in this room, as usePopBeat tracks it. */
export type RoomBeat = { id: string; holding: boolean; own: boolean };

/** What the screen knows besides the room: the beat, and what you have pressed. */
export type RoomPhaseInput = {
  room: Room;
  beat: RoomBeat | null;
  /** The match arrived while a pop was still holding the room. */
  matchInBeat: boolean;
  /** The balloon the chooser marked. */
  selectedId: string | null;
  /** The question the chooser marked. */
  questionId: string | null;
  /** A pop on its way to the server. */
  pendingPopId: string | null;
  sendingPop: boolean;
  /** You stayed to watch after your balloon popped. */
  watching: boolean;
  replaying: boolean;
  /** You left this room on the way to another one. */
  leftForReplay: boolean;
};

/**
 * What takes the screen: your popped view, the last pop of the game, the result,
 * a pop holding the room, or one of the live phases.
 */
export type RoomView =
  | 'popped'
  | 'climax'
  | 'result'
  | 'popNews'
  | 'picking'
  | 'answering'
  | 'reveal'
  | 'deciding';

/** The pop news at the top: the game's last pop, or a pop holding the room. */
export type RoomNewsKind = 'climax' | 'pop';

/** The line under the question: the hint while answering, the chooser's prompt, or who is deciding. */
export type RoomStatusLine = 'answering' | 'choose' | 'deciding';

/** What the footer holds. */
export type RoomFooterKind =
  /** The chooser left: get back in line. */
  | 'nextRoom'
  /** Popped and stayed to watch: the recap and the next room. */
  | 'recap'
  /** The match opens on its own: just the way home. */
  | 'home'
  | 'composer'
  | 'sent'
  | 'ask'
  /** The final two: keep one, the other pops. */
  | 'keep'
  | 'hold';

export type RoomPhase = {
  view: RoomView;
  isPopper: boolean;
  /** Your seat among the contestants, or -1 for the chooser. */
  myIndex: number;
  me: Contestant | undefined;
  /** Your balloon is still up. */
  iAmActive: boolean;
  finished: boolean;
  answering: boolean;
  isPopping: boolean;
  /** The game ended for you: it is over, or your balloon popped. */
  endedForMe: boolean;
  /** The room is still being played. */
  live: boolean;
  pending: Contestant | undefined;
  selected: Contestant | undefined;
  selectedQuestion: Question | undefined;
  winner: Contestant | undefined;
  canSelect: boolean;
  /** Balloons still up, in seat order. */
  up: Contestant[];
  /** Popped balloons, most recent pop first. */
  down: Contestant[];
  /** Still in and not on its way out: the list's live rows. */
  stillIn: Contestant[];
  /** The list's popped rows: a pop on its way first, then the popped ones. */
  poppedRows: Contestant[];
  finalTwo: boolean;
  beatPop: Contestant | undefined;
  holding: boolean;
  finalPopLive: boolean;
  climax: boolean;
  holdingPop: boolean;
  pickingNow: boolean;
  revealing: boolean;
  ownFinalPop: boolean;
  viewer: 'popper' | 'winner' | 'other';
  showPopped: boolean;
  showResult: boolean;
  showQuestionBlock: boolean;
  showList: boolean;
  myAnswer: string | null;
  myPhotoShowing: boolean;
  news: RoomNewsKind | null;
  statusLine: RoomStatusLine | null;
  footer: RoomFooterKind | null;
};

/**
 * Everything the game room shows, worked out from the room and a few things
 * only the screen knows. Plain data in, flags out, so it can be tested on its own.
 */
export function roomPhase(input: RoomPhaseInput): RoomPhase {
  const { room, beat, matchInBeat, selectedId, questionId, pendingPopId, sendingPop } = input;
  const isPopper = room.me.role === 'popper';
  const myIndex = room.contestants.findIndex((c) => c.id === room.me.id);
  const me = myIndex >= 0 ? room.contestants[myIndex] : undefined;
  const iAmActive = !!me && !me.popped;
  const finished = room.status === 'finished';
  const isPopping = room.status === 'popping';
  const answering = room.status === 'answering';
  const endedForMe =
    finished || room.contestants.some((c) => c.id === room.me.id && c.popped);
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

  const up = room.contestants.filter((c) => !c.popped);
  const down = room.contestants
    .filter((c) => c.popped)
    .sort((a, b) => (b.poppedInRound ?? 0) - (a.poppedInRound ?? 0));
  const finalTwo = !finished && up.length <= 2;

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
  const climax = finalPopLive && (holding || (!!room.matchId && matchInBeat));
  // A pop holding the room: on the popper's press, or as the next round starts.
  const holdingPop = holding && !!beatPop && (room.status === 'picking' || !!pending);
  const pickingNow = room.status === 'picking' && !holding;
  // The popper's reveal: the answer cards, side by side.
  const revealing = isPopper && isPopping && !holdingPop;
  const myPhotoShowing = !isPopper && isPopping && iAmActive && me.photos.length > 0;

  // Your own pop in the final, seen live: the room goes straight to the result.
  const ownFinalPop =
    finished && beatPop?.id === room.me.id && beatPop.poppedInRound === room.round;
  const viewer = isPopper ? 'popper' : room.winnerId === room.me.id ? 'winner' : 'other';
  // Your balloon is out: the popped view takes the room's place until you stay to
  // watch, or the game ends.
  const showPopped =
    !isPopper &&
    !!me?.popped &&
    (!me.left || input.replaying || input.leftForReplay) &&
    !input.watching &&
    !finished;

  const news: RoomNewsKind | null =
    climax && beatPop ? 'climax' : holdingPop && beatPop ? 'pop' : null;
  const showResult = finished && !climax;

  // The question, and what the room is waiting on under it.
  const showQuestionBlock = !!room.question && (answering || (isPopping && !holdingPop));
  const myAnswer = answering && iAmActive && me.answered ? me.answer : null;
  const statusLine: RoomStatusLine | null = !showQuestionBlock
    ? null
    : answering
      ? 'answering'
      : isPopper
        ? 'choose'
        : 'deciding';

  // Who is still in, then who has popped. A pop on its way already counts as popped.
  const showList = !showResult && !(isPopper && pickingNow) && !revealing;
  const stillIn = up.filter((c) => c.id !== pending?.id);
  const pendingRow = pending ? up.find((c) => c.id === pending.id) : undefined;
  const poppedRows = pendingRow ? [pendingRow, ...down] : down;

  let footer: RoomFooterKind | null = null;
  if (finished) {
    // While the last pop holds the room, nothing should pull you off this moment.
    footer = climax ? null : !winner && !isPopper ? 'nextRoom' : viewer === 'other' ? 'recap' : 'home';
  } else if (iAmActive && answering) {
    footer = me.answered ? 'sent' : 'composer';
  } else if (isPopper && pickingNow) {
    footer = 'ask';
  } else if (isPopper && isPopping && !pending && up.length === 2) {
    footer = 'keep';
  } else if (isPopper && isPopping && selected && !pending) {
    footer = 'hold';
  }

  let view: RoomView;
  if (showPopped) view = 'popped';
  else if (climax) view = 'climax';
  else if (finished) view = 'result';
  else if (holdingPop) view = 'popNews';
  else if (pickingNow) view = 'picking';
  else if (answering) view = 'answering';
  else if (revealing) view = 'reveal';
  else view = 'deciding';

  return {
    view,
    isPopper,
    myIndex,
    me,
    iAmActive,
    finished,
    answering,
    isPopping,
    endedForMe,
    live: !finished,
    pending,
    selected,
    selectedQuestion,
    winner,
    canSelect,
    up,
    down,
    stillIn,
    poppedRows,
    finalTwo,
    beatPop,
    holding,
    finalPopLive,
    climax,
    holdingPop,
    pickingNow,
    revealing,
    ownFinalPop,
    viewer,
    showPopped,
    showResult,
    showQuestionBlock,
    showList,
    myAnswer,
    myPhotoShowing,
    news,
    statusLine,
    footer,
  };
}
