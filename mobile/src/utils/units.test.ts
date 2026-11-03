import { expect, test } from 'vitest';

import { cmToFeetInches, feetInchesToCm, formatHeight } from './units';

test('formats a height in the chosen units', () => {
  expect(formatHeight(183, 'metric')).toBe('183 cm');
  expect(formatHeight(183, 'imperial')).toBe('6′0″');
});

test('never shows 12 inches', () => {
  expect(cmToFeetInches(182)).toEqual({ feet: 6, inches: 0 });
});

test('converts feet and inches to whole centimetres', () => {
  expect(feetInchesToCm(5, 10)).toBe(178);
  expect(feetInchesToCm(0, 70)).toBe(178);
});
