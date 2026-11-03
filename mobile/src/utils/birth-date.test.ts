import { describe, expect, test } from 'vitest';

import { ageFromBirthDate, parseBirthDate } from './birth-date';

const TODAY = new Date(2026, 10, 3);

describe('parseBirthDate', () => {
  test('pads a real date', () => {
    expect(parseBirthDate('5', '3', '2000', TODAY)).toBe('2000-03-05');
  });

  test.each([
    ['dates that do not exist', '31', '2', '2000'],
    ['29 February outside a leap year', '29', '2', '2001'],
    ['a month past December', '1', '13', '2000'],
    ['years before 1900', '1', '1', '1899'],
    ['letters', 'x', '1', '2000'],
    ['dates still to come', '4', '11', '2026'],
  ])('refuses %s', (_, day, month, year) => {
    expect(parseBirthDate(day, month, year, TODAY)).toBeNull();
  });

  test('takes 29 February in a leap year, and today', () => {
    expect(parseBirthDate('29', '2', '2000', TODAY)).toBe('2000-02-29');
    expect(parseBirthDate('3', '11', '2026', TODAY)).toBe('2026-11-03');
  });
});

describe('ageFromBirthDate', () => {
  test('turns a year older on the birthday, not before', () => {
    expect(ageFromBirthDate('2008-11-04', TODAY)).toBe(17);
    expect(ageFromBirthDate('2008-11-03', TODAY)).toBe(18);
    expect(ageFromBirthDate('2008-11-02', TODAY)).toBe(18);
  });
});
