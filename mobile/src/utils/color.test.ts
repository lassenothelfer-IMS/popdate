import { describe, expect, it } from 'vitest';

import { mix } from '@/utils/color';

describe('mix', () => {
  it('gives the base at 0 and the color at 1', () => {
    expect(mix('#102030', '#ffffff', 0)).toBe('#102030');
    expect(mix('#102030', '#ffffff', 1)).toBe('#ffffff');
  });

  it('mixes each channel and rounds', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#ff0000', '#0000ff', 0.25)).toBe('#bf0040');
  });

  it('takes colors with or without #', () => {
    expect(mix('000000', 'FFFFFF', 1)).toBe('#ffffff');
  });
});
