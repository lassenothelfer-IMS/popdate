import { describe, expect, it } from 'vitest';

import {
  balloonCount,
  canPlay,
  credit,
  FREE_BALLOONS,
  newWallet,
  nextRefillAt,
  refilled,
  spend,
  STARTER_BALLOONS,
  viewOf,
  type BalloonWallet,
} from './balloons';

const DAY = 24 * 60 * 60_000;
const NOON = Date.UTC(2026, 10, 6, 12);

describe('balloons', () => {
  it('starts a new account with the free ones plus the starter ones', () => {
    const wallet = newWallet(NOON);
    expect(wallet.free + wallet.extra).toBe(FREE_BALLOONS + STARTER_BALLOONS);
  });

  it('spends the free ones first, then the bought ones, never below zero', () => {
    let wallet: BalloonWallet = { free: 1, extra: 1, refillDay: '2026-11-06' };
    wallet = spend(wallet, NOON);
    expect(wallet).toMatchObject({ free: 0, extra: 1 });
    wallet = spend(wallet, NOON);
    expect(wallet).toMatchObject({ free: 0, extra: 0 });
    expect(canPlay(wallet, NOON)).toBe(false);
    wallet = spend(wallet, NOON);
    expect(wallet).toMatchObject({ free: 0, extra: 0 });
  });

  it('tops the free ones up on a new day, but never takes any away', () => {
    const empty: BalloonWallet = { free: 0, extra: 4, refillDay: '2026-11-06' };
    expect(refilled(empty, NOON)).toBe(empty);
    expect(refilled(empty, NOON + DAY)).toMatchObject({ free: FREE_BALLOONS, extra: 4, refillDay: '2026-11-07' });
    expect(canPlay({ ...empty, extra: 0 }, NOON + DAY)).toBe(true);
    const lots: BalloonWallet = { free: FREE_BALLOONS + 2, extra: 0, refillDay: '2026-11-06' };
    expect(refilled(lots, NOON + DAY).free).toBe(FREE_BALLOONS + 2);
  });

  it('refills at UTC midnight', () => {
    expect(nextRefillAt(NOON)).toBe(Date.UTC(2026, 10, 7));
    expect(nextRefillAt(Date.UTC(2026, 11, 31, 23, 59))).toBe(Date.UTC(2027, 0, 1));
  });

  it('spends nothing with Popdate+, until it runs out', () => {
    const wallet: BalloonWallet = { free: 0, extra: 0, refillDay: '2026-11-06', plusUntil: NOON + 1000 };
    expect(canPlay(wallet, NOON)).toBe(true);
    expect(spend(wallet, NOON)).toMatchObject({ free: 0, extra: 0 });
    expect(balloonCount(viewOf(wallet, NOON), NOON)).toBeNull();
    expect(canPlay(wallet, NOON + 2000)).toBe(false);
  });

  it('adds a bought pack to the ones that never expire', () => {
    const wallet: BalloonWallet = { free: 0, extra: 1, refillDay: '2026-11-05' };
    expect(credit(wallet, 5, NOON)).toMatchObject({ free: FREE_BALLOONS, extra: 6, refillDay: '2026-11-06' });
  });

  it('counts an old view as refilled once its refill time has passed', () => {
    const view = viewOf({ free: 0, extra: 2, refillDay: '2026-11-06' }, NOON);
    expect(balloonCount(view, NOON)).toBe(2);
    expect(balloonCount(view, view.refillsAt)).toBe(FREE_BALLOONS + 2);
  });
});
