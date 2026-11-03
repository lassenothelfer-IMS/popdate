import { describe, expect, it } from 'vitest';

import { cmToFeetInches, feetInchesToCm, formatHeight } from '@/utils/units';

describe('units', () => {
  it('formats heights in both systems', () => {
    expect(formatHeight(183.4, 'metric')).toBe('183 cm');
    expect(formatHeight(183, 'imperial')).toBe('6′0″');
  });

  it('round-trips feet and inches', () => {
    expect(cmToFeetInches(170)).toEqual({ feet: 5, inches: 7 });
    expect(feetInchesToCm(5, 7)).toBe(170);
  });
});

describe('units round trips', () => {
  it('keeps every height in the app range within half an inch', () => {
    // Imperial rounds to whole inches, so going back lands at most half an inch (1.27 cm) off.
    for (let cm = 120; cm <= 230; cm++) {
      const { feet, inches } = cmToFeetInches(cm);
      expect(Math.abs(feetInchesToCm(feet, inches) - cm)).toBeLessThanOrEqual(1.27);
    }
  });

  it('gives back the same feet and inches', () => {
    for (let feet = 4; feet <= 7; feet++) {
      for (let inches = 0; inches < 12; inches++) {
        expect(cmToFeetInches(feetInchesToCm(feet, inches))).toEqual({ feet, inches });
      }
    }
  });

  it('never shows 12 inches', () => {
    // 182.5 cm is 71.85 inches, which rounds up to a whole 6 feet.
    expect(cmToFeetInches(182.5)).toEqual({ feet: 6, inches: 0 });
    expect(formatHeight(182.5, 'imperial')).toBe('6′0″');
  });

  it('rounds metric heights to whole centimetres', () => {
    expect(formatHeight(170.5, 'metric')).toBe('171 cm');
    expect(formatHeight(170.4, 'metric')).toBe('170 cm');
  });
});
