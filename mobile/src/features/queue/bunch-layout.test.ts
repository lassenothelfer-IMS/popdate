import { describe, expect, it } from 'vitest';

import {
  bunchScale,
  changeDelay,
  GHOST_SCALE,
  HAND,
  knotOf,
  PAINT_ORDER,
  seatColorOf,
  SLOTS,
  STAGE,
  SWAY_PHASES,
} from '@/features/queue/bunch-layout';
import { LOBBY_SIZE } from '@/shared/limits';

/** The app's balloon is drawn in a 24 x 34 box (components/balloon.tsx). */
const balloonHeight = (size: number) => (size * 34) / 24;

describe('the queue bunch', () => {
  it('has a seat, a place in the paint order and a sway phase for every player', () => {
    expect(SLOTS.length).toBeGreaterThanOrEqual(LOBBY_SIZE);
    expect([...PAINT_ORDER].sort()).toEqual(SLOTS.map((_, index) => index));
    expect(SWAY_PHASES.length).toBe(SLOTS.length);
  });

  it('keeps every balloon inside the box, above the hand', () => {
    for (const slot of SLOTS) {
      expect(slot.cx - slot.size / 2).toBeGreaterThanOrEqual(0);
      expect(slot.cx + slot.size / 2).toBeLessThanOrEqual(STAGE.width);
      expect(slot.top).toBeGreaterThanOrEqual(0);
      expect(slot.top + balloonHeight(slot.size)).toBeLessThan(HAND.y);
      expect(knotOf(slot).y).toBeLessThan(HAND.y);
    }
  });

  it('puts you biggest, in the middle and in front', () => {
    const [you, ...others] = SLOTS;
    expect(you.cx).toBe(HAND.x);
    for (const other of others) expect(other.size).toBeLessThan(you.size);
    expect(PAINT_ORDER[PAINT_ORDER.length - 1]).toBe(0);
    expect(GHOST_SCALE).toBeLessThan(1);
  });

  it('gives you the brand balloon and never repeats a seat color', () => {
    const colors = SLOTS.map((_, index) => seatColorOf(index));
    expect(colors[0]).toBe('you');
    const seats = colors.filter((color) => typeof color === 'number');
    expect(new Set(seats).size).toBe(seats.length);
    expect(colors[5]).toBe('neutral');
  });

  it('scales to the smaller side and never past 1.15x', () => {
    expect(bunchScale(300, 330)).toBe(1);
    expect(bunchScale(150, 330)).toBe(0.5);
    expect(bunchScale(300, 165)).toBe(0.5);
    expect(bunchScale(3000, 3000)).toBe(1.15);
    expect(bunchScale(0, 300)).toBe(0);
  });

  it('blooms arrivals in join order and lets the newest go first', () => {
    // 2 -> 5: seats 2, 3 and 4 bloom one after another.
    expect([2, 3, 4].map((index) => changeDelay(index, 2))).toEqual([0, 120, 240]);
    // 5 -> 2: seat 4 goes first, then 3, then 2.
    expect([4, 3, 2].map((index) => changeDelay(index, 5))).toEqual([0, 150, 300]);
  });
});
