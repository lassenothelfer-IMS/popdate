import { describe, expect, it } from 'vitest';

import {
  REVEAL_CARD_IN_MS,
  REVEAL_HOLD_MS,
  REVEAL_PHOTO_IN_MS,
  revealEndsAt,
  revealReadMs,
  revealTurnAt,
  revealTurnMs,
  revealWithout,
} from './reveal';

const FRAME = REVEAL_CARD_IN_MS + REVEAL_PHOTO_IN_MS + REVEAL_HOLD_MS;

describe('revealReadMs', () => {
  it('gives short answers the minimum and grows a quarter second a word', () => {
    expect(revealReadMs('Pizza, obviously')).toBe(2500);
    expect(revealReadMs(Array(20).fill('word').join(' '))).toBe(1500 + 20 * 250);
  });

  it('caps long answers and keeps a missing one short', () => {
    expect(revealReadMs(Array(50).fill('word').join(' '))).toBe(9000);
    expect(revealReadMs(null)).toBe(1200);
    expect(revealReadMs('   ')).toBe(1200);
  });

  it('frames the reading time with the card, the photo and the hold', () => {
    expect(revealTurnMs('hi')).toBe(FRAME + 2500);
  });
});

describe('revealTurnAt', () => {
  const reveal = {
    startsAt: 10_000,
    turns: [
      { id: 'a', ms: 4000 },
      { id: 'b', ms: 6000 },
    ],
  };

  it('waits on the first turn before the reveal starts', () => {
    expect(revealTurnAt(reveal, 9000)).toMatchObject({ index: 0, startsAt: 10_000, elapsed: 0 });
  });

  it('walks the turns on the schedule', () => {
    expect(revealTurnAt(reveal, 13_999)).toMatchObject({ index: 0, elapsed: 3999 });
    expect(revealTurnAt(reveal, 14_000)).toMatchObject({ index: 1, startsAt: 14_000, elapsed: 0 });
  });

  it('is over when the last turn ends, where the pop time starts', () => {
    expect(revealEndsAt(reveal)).toBe(20_000);
    expect(revealTurnAt(reveal, 20_000)).toBeNull();
  });
});

describe('revealWithout', () => {
  const reveal = {
    startsAt: 10_000,
    turns: [
      { id: 'a', ms: 4000 },
      { id: 'b', ms: 6000 },
      { id: 'c', ms: 5000 },
    ],
  };

  it('drops a turn that has not started, and the ones after move up', () => {
    expect(revealWithout(reveal, 'c', 12_000).turns.map((t) => t.id)).toEqual(['a', 'b']);
    expect(revealEndsAt(revealWithout(reveal, 'b', 12_000))).toBe(19_000);
  });

  it('lets a turn already on screen play out', () => {
    expect(revealWithout(reveal, 'a', 12_000)).toBe(reveal);
    expect(revealWithout(reveal, 'z', 12_000)).toBe(reveal);
  });
});
