import { describe, expect, it } from 'vitest';

import {
  catalogFrom,
  featuredIndex,
  formatMoney,
  fullPrice,
  packSaving,
  perMonth,
  placeholderCatalog,
  planSaving,
} from '@/features/paywall/catalog';

describe('the paywall catalog', () => {
  it('keeps only the ids Popdate sells, packs small to large and plans in order', () => {
    const catalog = catalogFrom([
      {
        id: 'popdate.plus.yearly',
        price: 49.99,
        currency: 'USD',
        priceLabel: '$49.99',
      },
      {
        id: 'popdate.balloons.15',
        price: 6.99,
        currency: 'USD',
        priceLabel: '$6.99',
      },
      { id: 'something.else', price: 1, currency: 'USD', priceLabel: '$1.00' },
      {
        id: 'popdate.plus.weekly',
        price: 4.99,
        currency: 'USD',
        priceLabel: '$4.99',
      },
      {
        id: 'popdate.balloons.5',
        price: 2.99,
        currency: 'USD',
        priceLabel: '$2.99',
      },
    ]);
    expect(catalog.packs.map((pack) => pack.balloons)).toEqual([5, 15]);
    expect(catalog.plans.map((plan) => plan.plan)).toEqual(['weekly', 'annual']);
    expect(catalog.placeholder).toBe(false);
  });

  it('opens on the featured pack, or the middle one when the store lacks it', () => {
    const { packs } = placeholderCatalog();
    expect(packs[featuredIndex(packs)].balloons).toBe(15);
    expect(featuredIndex(packs.filter((pack) => pack.balloons !== 15))).toBe(0);
  });

  it('works out pack savings per balloon, never rounding up', () => {
    const { packs } = placeholderCatalog();
    // 40 for CHF 32 is 0.80 a balloon against 1.40: 42.9% less.
    expect(packs.map((pack) => packSaving(pack, packs))).toEqual([0, 28, 42]);
  });

  it('compares plans with the weekly price over the same time', () => {
    const { plans } = placeholderCatalog();
    const [weekly, sixMonths, annual] = plans;
    expect(fullPrice(weekly, plans)).toBeNull();
    expect(fullPrice(annual, plans)).toBeCloseTo(9.9 * 52);
    expect(planSaving(sixMonths, plans)).toBe(81);
    expect(planSaving(annual, plans)).toBe(86);
    expect(perMonth(annual)).toBeCloseTo(5.9);
    expect(perMonth(sixMonths)).toBeCloseTo(7.9);
  });

  it('formats money in the store currency', () => {
    expect(formatMoney(15, 'CHF', 'en-CH')).toMatch(/CHF.15\.00/);
  });
});
