import { describe, expect, it } from 'vitest';

import { hasProfanity, maskProfanity } from '@/utils/profanity';

describe('profanity', () => {
  it('masks a word with bullets of the same length', () => {
    expect(maskProfanity('what the fuck')).toBe('what the ••••');
    expect(maskProfanity('Oh shit, really?')).toBe('Oh ••••, really?');
  });

  it('ignores case', () => {
    expect(maskProfanity('SHIT happens')).toBe('•••• happens');
    expect(hasProfanity('BullShit')).toBe(true);
  });

  it('only matches whole words', () => {
    expect(maskProfanity('Scunthorpe and a classic dickens novel')).toBe(
      'Scunthorpe and a classic dickens novel',
    );
    expect(hasProfanity('assessment')).toBe(false);
    expect(hasProfanity('cocktail')).toBe(false);
  });

  it('leaves clean text alone', () => {
    const text = 'A long walk, a good coffee and zero plans.';
    expect(hasProfanity(text)).toBe(false);
    expect(maskProfanity(text)).toBe(text);
  });

  it('filters all four languages', () => {
    expect(maskProfanity('Du Arschloch')).toBe('Du •••••••••');
    expect(maskProfanity('Quelle merde')).toBe('Quelle •••••');
    expect(maskProfanity('Che cazzo dici')).toBe('Che ••••• dici');
    expect(hasProfanity('you wanker')).toBe(true);
  });

  it('matches with or without accents', () => {
    expect(hasProfanity('enculé')).toBe(true);
    expect(hasProfanity('ENCULE')).toBe(true);
    expect(hasProfanity('batard')).toBe(true);
    expect(hasProfanity('Bâtard')).toBe(true);
    expect(maskProfanity('Scheiße!')).toBe('•••••••!');
  });

  it('masks every match in a sentence', () => {
    expect(maskProfanity('shit, merde, cazzo')).toBe('••••, •••••, •••••');
  });
});
