import { describe, expect, it } from 'vitest';

import type { Contestant, Room } from '@/api/types';
import { roomPhase, type RoomPhaseInput } from '@/features/game/room-phase';

const CHOOSER = 'p';
const IDS = ['a', 'b', 'c', 'd', 'e'];

function contestant(id: string, extra: Partial<Contestant> = {}): Contestant {
  return {
    id,
    name: id.toUpperCase(),
    age: 30,
    photos: [],
    popped: false,
    poppedInRound: null,
    left: false,
    answered: false,
    answer: null,
    ...extra,
  };
}

/** A room seen by `meId`, with the given contestants changed. */
function room(meId: string, extra: Partial<Room> = {}, changes: Record<string, Partial<Contestant>> = {}): Room {
  return {
    id: 'room',
    status: 'picking',
    round: 1,
    totalRounds: 4,
    popper: { id: CHOOSER, name: 'Nico', age: 31, photos: [] },
    contestants: IDS.map((id) => contestant(id, changes[id])),
    question: null,
    questionOptions: [
      { id: 'q1', text: 'First?' },
      { id: 'q2', text: 'Second?' },
    ],
    deadline: null,
    popReminder: false,
    winnerId: null,
    matchId: null,
    me: { id: meId, role: meId === CHOOSER ? 'popper' : 'contestant' },
    ...extra,
  };
}

function phase(r: Room, extra: Partial<Omit<RoomPhaseInput, 'room'>> = {}) {
  return roomPhase({
    room: r,
    beat: null,
    matchInBeat: false,
    selectedId: null,
    questionId: null,
    pendingPopId: null,
    sendingPop: false,
    watching: false,
    replaying: false,
    leftForReplay: false,
    ...extra,
  });
}

const question = { id: 'q1', text: 'First?' };
const popped = (round: number): Partial<Contestant> => ({ popped: true, poppedInRound: round });

describe('roomPhase: picking', () => {
  it('gives the chooser the picker and the Ask button', () => {
    const p = phase(room(CHOOSER), { questionId: 'q2' });
    expect(p.view).toBe('picking');
    expect(p.isPopper).toBe(true);
    expect(p.pickingNow).toBe(true);
    expect(p.selectedQuestion?.id).toBe('q2');
    expect(p.footer).toBe('ask');
    expect(p.showList).toBe(false);
    expect(p.showQuestionBlock).toBe(false);
    expect(p.me).toBeUndefined();
    expect(p.myIndex).toBe(-1);
  });

  it('shows a contestant the waiting line and the list, with no footer', () => {
    const p = phase(room('a'), { questionId: 'q2' });
    expect(p.view).toBe('picking');
    expect(p.isPopper).toBe(false);
    expect(p.iAmActive).toBe(true);
    expect(p.selectedQuestion?.id).toBe('q2');
    expect(p.footer).toBeNull();
    expect(p.showList).toBe(true);
    expect(p.up).toHaveLength(5);
  });

  it('ignores a marked question that is not an option', () => {
    expect(phase(room(CHOOSER), { questionId: 'gone' }).selectedQuestion).toBeUndefined();
  });

  it('holds the next round on the pop news while the beat plays', () => {
    const r = room('a', { round: 2 }, { c: popped(1) });
    const p = phase(r, { beat: { id: 'c', holding: true, own: false } });
    expect(p.view).toBe('popNews');
    expect(p.holding).toBe(true);
    expect(p.holdingPop).toBe(true);
    expect(p.pickingNow).toBe(false);
    expect(p.news).toBe('pop');
    expect(p.beatPop?.id).toBe('c');
  });

  it('lets the picking phase in once the beat is over', () => {
    const r = room(CHOOSER, { round: 2 }, { c: popped(1) });
    const p = phase(r, { beat: { id: 'c', holding: false, own: true } });
    expect(p.view).toBe('picking');
    expect(p.holding).toBe(false);
    expect(p.news).toBeNull();
    expect(p.footer).toBe('ask');
  });
});

describe('roomPhase: answering', () => {
  const answering = { status: 'answering', question } as const;

  it('gives a contestant who has not answered the composer', () => {
    const p = phase(room('a', answering));
    expect(p.view).toBe('answering');
    expect(p.footer).toBe('composer');
    expect(p.myAnswer).toBeNull();
    expect(p.showQuestionBlock).toBe(true);
    expect(p.statusLine).toBe('answering');
    expect(p.showList).toBe(true);
  });

  it('shows a contestant their sent answer', () => {
    const p = phase(room('a', answering, { a: { answered: true, answer: 'Tea' } }));
    expect(p.footer).toBe('sent');
    expect(p.myAnswer).toBe('Tea');
  });

  it('shows the chooser the question and the list, with no footer', () => {
    const p = phase(room(CHOOSER, answering));
    expect(p.view).toBe('answering');
    expect(p.footer).toBeNull();
    expect(p.myAnswer).toBeNull();
    expect(p.statusLine).toBe('answering');
    expect(p.showList).toBe(true);
    expect(p.revealing).toBe(false);
  });
});

describe('roomPhase: popping', () => {
  const popping = { status: 'popping', question } as const;

  it('reveals the cards to the chooser and holds to pop the marked one', () => {
    const p = phase(room(CHOOSER, popping), { selectedId: 'b' });
    expect(p.view).toBe('reveal');
    expect(p.revealing).toBe(true);
    expect(p.canSelect).toBe(true);
    expect(p.selected?.id).toBe('b');
    expect(p.footer).toBe('hold');
    expect(p.statusLine).toBe('choose');
    expect(p.showList).toBe(false);
  });

  it('has no Pop button until a balloon is marked', () => {
    const p = phase(room(CHOOSER, popping));
    expect(p.selected).toBeUndefined();
    expect(p.footer).toBeNull();
  });

  it('stops marking while a pop is on its way', () => {
    const p = phase(room(CHOOSER, popping), { sendingPop: true, selectedId: 'b' });
    expect(p.canSelect).toBe(false);
  });

  it('holds the room on the chooser press until the server has the pop', () => {
    const p = phase(room(CHOOSER, popping), {
      selectedId: 'b',
      pendingPopId: 'b',
      sendingPop: true,
      beat: { id: 'b', holding: true, own: true },
    });
    expect(p.view).toBe('popNews');
    expect(p.pending?.id).toBe('b');
    expect(p.holdingPop).toBe(true);
    expect(p.revealing).toBe(false);
    expect(p.footer).toBeNull();
    expect(p.showQuestionBlock).toBe(false);
    expect(p.stillIn.map((c) => c.id)).toEqual(['a', 'c', 'd', 'e']);
    expect(p.poppedRows.map((c) => c.id)).toEqual(['b']);
  });

  it('shows a waiting contestant the deciding line and their photo', () => {
    const p = phase(room('a', popping, { a: { photos: ['one.jpg'] } }));
    expect(p.view).toBe('deciding');
    expect(p.statusLine).toBe('deciding');
    expect(p.myPhotoShowing).toBe(true);
    expect(p.footer).toBeNull();
    expect(p.showList).toBe(true);
  });

  it('has no photo to show before one is revealed', () => {
    expect(phase(room('a', popping)).myPhotoShowing).toBe(false);
  });

  it('lets a popped contestant who stayed watch the room', () => {
    const r = room('a', { ...popping, round: 2 }, { a: popped(1) });
    const p = phase(r, { watching: true });
    expect(p.showPopped).toBe(false);
    expect(p.view).toBe('deciding');
    expect(p.iAmActive).toBe(false);
    expect(p.myPhotoShowing).toBe(false);
    expect(p.endedForMe).toBe(true);
    expect(p.down.map((c) => c.id)).toEqual(['a']);
  });

  it('sorts the popped ones most recent first', () => {
    const r = room('a', { ...popping, round: 3 }, { b: popped(1), d: popped(2) });
    expect(phase(r).down.map((c) => c.id)).toEqual(['d', 'b']);
  });
});

describe('roomPhase: final two', () => {
  const finalTwo = { status: 'popping', round: 4, question } as const;
  const out = { a: popped(1), b: popped(2), c: popped(3) };

  it('offers the chooser Keep buttons instead of a hold', () => {
    const p = phase(room(CHOOSER, finalTwo, out), { selectedId: 'd' });
    expect(p.finalTwo).toBe(true);
    expect(p.up.map((c) => c.id)).toEqual(['d', 'e']);
    expect(p.footer).toBe('keep');
    expect(p.view).toBe('reveal');
  });

  it('marks the final two for a contestant still in', () => {
    const p = phase(room('d', finalTwo, out));
    expect(p.finalTwo).toBe(true);
    expect(p.view).toBe('deciding');
    expect(p.iAmActive).toBe(true);
  });
});

describe('roomPhase: finished with a match', () => {
  const won = { status: 'finished', round: 4, winnerId: 'e', matchId: 'm' } as const;
  const out = { a: popped(1), b: popped(2), c: popped(3), d: popped(4) };

  it('keeps the last pop on screen for the chooser while it holds the room', () => {
    const p = phase(room(CHOOSER, won, out), { beat: { id: 'd', holding: true, own: true } });
    expect(p.view).toBe('climax');
    expect(p.finalPopLive).toBe(true);
    expect(p.climax).toBe(true);
    expect(p.news).toBe('climax');
    expect(p.showResult).toBe(false);
    expect(p.footer).toBeNull();
    expect(p.viewer).toBe('popper');
    expect(p.finalTwo).toBe(false);
    expect(p.live).toBe(false);
  });

  it('keeps the climax after the beat when the match came during it', () => {
    const p = phase(room(CHOOSER, won, out), {
      beat: { id: 'd', holding: false, own: true },
      matchInBeat: true,
    });
    expect(p.climax).toBe(true);
    expect(p.footer).toBeNull();
  });

  it('shows the chooser the result when the match came after the beat', () => {
    const p = phase(room(CHOOSER, won, out), { beat: { id: 'd', holding: false, own: true } });
    expect(p.view).toBe('result');
    expect(p.climax).toBe(false);
    expect(p.showResult).toBe(true);
    expect(p.footer).toBe('home');
    expect(p.showList).toBe(false);
  });

  it('tells the winner they were chosen', () => {
    const p = phase(room('e', won, out));
    expect(p.viewer).toBe('winner');
    expect(p.winner?.id).toBe('e');
    expect(p.view).toBe('result');
    expect(p.footer).toBe('home');
    expect(p.endedForMe).toBe(true);
  });

  it('goes straight to the result for the one popped in the final', () => {
    const p = phase(room('d', won, out), { beat: { id: 'd', holding: true, own: false } });
    expect(p.ownFinalPop).toBe(true);
    expect(p.holding).toBe(false);
    expect(p.climax).toBe(false);
    expect(p.showPopped).toBe(false);
    expect(p.view).toBe('result');
    expect(p.viewer).toBe('other');
    expect(p.footer).toBe('recap');
  });

  it('offers a popped viewer the recap and the next room', () => {
    const p = phase(room('a', won, out), { watching: true });
    expect(p.viewer).toBe('other');
    expect(p.view).toBe('result');
    expect(p.footer).toBe('recap');
  });
});

describe('roomPhase: chooser left', () => {
  const ended = { status: 'finished', round: 2 } as const;

  it('sends a contestant back in line with no match', () => {
    const p = phase(room('a', ended));
    expect(p.winner).toBeUndefined();
    expect(p.view).toBe('result');
    expect(p.footer).toBe('nextRoom');
    expect(p.showPopped).toBe(false);
  });

  it('sends a popped contestant who was out back in line too', () => {
    const p = phase(room('a', ended, { a: popped(1) }));
    expect(p.showPopped).toBe(false);
    expect(p.footer).toBe('nextRoom');
  });
});

describe('roomPhase: popped mid-room', () => {
  const next = { status: 'picking', round: 2 } as const;

  it('takes the room over with the popped view', () => {
    const p = phase(room('a', next, { a: popped(1) }), {
      beat: { id: 'a', holding: true, own: false },
    });
    expect(p.view).toBe('popped');
    expect(p.showPopped).toBe(true);
    expect(p.iAmActive).toBe(false);
    // Your own pop never holds the room.
    expect(p.holding).toBe(false);
    expect(p.endedForMe).toBe(true);
  });

  it('lets you go once you left, unless you are on your way to another room', () => {
    const left = room('a', next, { a: { ...popped(1), left: true } });
    expect(phase(left).showPopped).toBe(false);
    expect(phase(left, { replaying: true }).showPopped).toBe(true);
    expect(phase(left, { leftForReplay: true }).showPopped).toBe(true);
  });

  it('never shows the chooser the popped view', () => {
    expect(phase(room(CHOOSER, next, { a: popped(1) })).showPopped).toBe(false);
  });
});
