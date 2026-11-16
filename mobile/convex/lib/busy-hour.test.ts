import { expect, test } from 'vitest';

import { busiestHour } from './busy-hour';

const now = Date.UTC(2026, 10, 16, 12);
const at = (daysAgo: number, hourUtc: number) =>
  Date.UTC(2026, 10, 16 - daysAgo, hourUtc, 15);

test('the hour most rooms of the last two weeks started in', () => {
  const rooms = [at(1, 19), at(2, 19), at(3, 19), at(1, 18), at(4, 20), at(20, 7), at(21, 7), at(22, 7)];
  expect(busiestHour(rooms, now)).toBe(19);
});

test('null while there are too few rooms to say', () => {
  expect(busiestHour([at(1, 19), at(2, 19), at(3, 19)], now)).toBeNull();
  // Old rooms don't count toward the minimum.
  expect(busiestHour([at(1, 19), at(30, 19), at(31, 19), at(32, 19), at(33, 19)], now)).toBeNull();
});
