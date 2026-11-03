import { describe, expect, it } from 'vitest';

import { MAX_AGE, ageFromBirthDate, parseBirthDate } from '@/utils/birth-date';

/** A fixed "today", so the tests don't change with the calendar: 15 June 2026. */
const TODAY = new Date(2026, 5, 15);

describe('parseBirthDate', () => {
  it('turns valid fields into YYYY-MM-DD', () => {
    expect(parseBirthDate('5', '3', '1998', TODAY)).toBe('1998-03-05');
    expect(parseBirthDate('31', '12', '2000', TODAY)).toBe('2000-12-31');
  });

  it('rejects dates that do not exist', () => {
    expect(parseBirthDate('31', '4', '1998', TODAY)).toBeNull();
    expect(parseBirthDate('0', '1', '1998', TODAY)).toBeNull();
    expect(parseBirthDate('1', '13', '1998', TODAY)).toBeNull();
    expect(parseBirthDate('1', '0', '1998', TODAY)).toBeNull();
  });

  it('rejects fields that are not whole numbers', () => {
    expect(parseBirthDate('', '1', '1998', TODAY)).toBeNull();
    expect(parseBirthDate('1.5', '1', '1998', TODAY)).toBeNull();
    expect(parseBirthDate('a', 'b', 'c', TODAY)).toBeNull();
  });

  it('takes Feb 29 only in a leap year', () => {
    expect(parseBirthDate('29', '2', '2000', TODAY)).toBe('2000-02-29');
    expect(parseBirthDate('29', '2', '2004', TODAY)).toBe('2004-02-29');
    expect(parseBirthDate('29', '2', '2001', TODAY)).toBeNull();
    expect(parseBirthDate('29', '2', '1900', TODAY)).toBeNull();
  });

  it('rejects dates in the future, but takes today', () => {
    expect(parseBirthDate('16', '6', '2026', TODAY)).toBeNull();
    expect(parseBirthDate('1', '1', '2030', TODAY)).toBeNull();
    expect(parseBirthDate('15', '6', '2026', TODAY)).toBe('2026-06-15');
  });

  it('rejects years before 1900', () => {
    expect(parseBirthDate('1', '1', '1899', TODAY)).toBeNull();
    expect(parseBirthDate('1', '1', '1900', TODAY)).toBe('1900-01-01');
  });
});

describe('ageFromBirthDate', () => {
  it('counts a birthday from the day itself', () => {
    expect(ageFromBirthDate('2008-06-15', TODAY)).toBe(18);
    expect(ageFromBirthDate('2008-06-16', TODAY)).toBe(17);
    expect(ageFromBirthDate('2008-07-01', TODAY)).toBe(17);
    expect(ageFromBirthDate('2008-01-01', TODAY)).toBe(18);
  });

  it('tells who is under 18', () => {
    const birthDate = parseBirthDate('16', '6', '2008', TODAY);
    expect(birthDate).toBe('2008-06-16');
    expect(ageFromBirthDate(birthDate!, TODAY)).toBeLessThan(18);
  });

  it('tells who is over the oldest age', () => {
    expect(ageFromBirthDate('1906-06-15', TODAY)).toBe(MAX_AGE);
    expect(ageFromBirthDate('1905-06-15', TODAY)).toBeGreaterThan(MAX_AGE);
  });

  it('turns a Feb 29 birthday a year older on Mar 1 outside leap years', () => {
    expect(ageFromBirthDate('2000-02-29', new Date(2027, 1, 28))).toBe(26);
    expect(ageFromBirthDate('2000-02-29', new Date(2027, 2, 1))).toBe(27);
    expect(ageFromBirthDate('2000-02-29', new Date(2028, 1, 29))).toBe(28);
  });
});
