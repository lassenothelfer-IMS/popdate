import { BALLOON_PACKS, FEATURED_PACK, PLUS_PLANS, type PlusPlan } from '@/shared/balloons';
import type { StoreProduct } from '@/utils/purchases';

/**
 * What the paywalls sell, with the store's prices: the balloon packs and the
 * Popdate+ plans, by the ids in `shared/balloons.ts`. Everything the screens
 * work out from a price (per balloon, per month, the savings) is here.
 */

export type Pack = {
  id: string;
  balloons: number;
  price: number;
  currency: string;
};
export type Plan = {
  id: string;
  plan: PlusPlan;
  price: number;
  currency: string;
};

export type Catalog = {
  packs: Pack[];
  plans: Plan[];
  /** The design's sample prices, shown where no store can be asked (the web). Never sold. */
  placeholder: boolean;
};

export const PLAN_ORDER: readonly PlusPlan[] = ['weekly', 'sixMonths', 'annual'];
/** The plan the paywall opens on. */
export const DEFAULT_PLAN: PlusPlan = 'annual';

/** How many weeks and months each plan runs, to compare them. */
const WEEKS: Record<PlusPlan, number> = {
  weekly: 1,
  sixMonths: 26,
  annual: 52,
};
const MONTHS: Record<PlusPlan, number> = {
  weekly: 12 / 52,
  sixMonths: 6,
  annual: 12,
};

/**
 * When the Popdate+ intro offer ends, in epoch ms, or null while there is none.
 * The paywall's "Intro offer ends in" chip only counts down to a real end: a
 * timer that starts over on every visit is fake urgency, which App Review
 * rejects and Swiss and EU consumer law forbid. Development builds show a sample.
 */
export const PLUS_OFFER_ENDS_AT: number | null = null;

/** The design's sample prices, in CHF. Only for the placeholder catalog. */
const SAMPLE_PRICES: Record<string, number> = {
  'popdate.balloons.5': 7,
  'popdate.balloons.15': 15,
  'popdate.balloons.40': 32,
  [PLUS_PLANS.weekly]: 9.9,
  [PLUS_PLANS.sixMonths]: 47.4,
  [PLUS_PLANS.annual]: 70.8,
};

const PLAN_OF = Object.fromEntries(
  Object.entries(PLUS_PLANS).map(([plan, id]) => [id, plan as PlusPlan]),
) as Record<string, PlusPlan>;

export const PACK_IDS = Object.keys(BALLOON_PACKS);
export const PLAN_IDS = Object.values(PLUS_PLANS);

/** The packs and plans among the store's products, small to large. Ids the store doesn't sell are left out. */
export function catalogFrom(products: StoreProduct[], placeholder = false): Catalog {
  const packs: Pack[] = [];
  const plans: Plan[] = [];
  for (const { id, price, currency } of products) {
    if (BALLOON_PACKS[id] !== undefined)
      packs.push({ id, balloons: BALLOON_PACKS[id], price, currency });
    else if (PLAN_OF[id]) plans.push({ id, plan: PLAN_OF[id], price, currency });
  }
  packs.sort((a, b) => a.balloons - b.balloons);
  plans.sort((a, b) => PLAN_ORDER.indexOf(a.plan) - PLAN_ORDER.indexOf(b.plan));
  return { packs, plans, placeholder };
}

/** Every pack and plan at the design's sample prices. */
export function placeholderCatalog(): Catalog {
  const ids = [...PACK_IDS, ...PLAN_IDS];
  return catalogFrom(
    ids.map((id) => ({
      id,
      price: SAMPLE_PRICES[id],
      currency: 'CHF',
      priceLabel: '',
    })),
    true,
  );
}

/** The pack the sheet opens on: the featured one, or the middle one if the store lacks it. */
export function featuredIndex(packs: Pack[]) {
  const index = packs.findIndex((pack) => pack.id === FEATURED_PACK);
  return index >= 0 ? index : Math.max(0, Math.floor((packs.length - 1) / 2));
}

export function perBalloon(pack: Pack) {
  return pack.price / pack.balloons;
}

/**
 * How much less a balloon costs in this pack than in the smallest one, in whole
 * percent, rounded down so it never claims more than it saves. 0 for the smallest.
 */
export function packSaving(pack: Pack, packs: Pack[]) {
  const base = packs[0];
  if (!base || base.id === pack.id || base.currency !== pack.currency) return 0;
  return Math.max(0, Math.floor((1 - perBalloon(pack) / perBalloon(base)) * 100));
}

/** What this plan's time would cost at the weekly price: the struck-through price. Null for weekly, or without one. */
export function fullPrice(plan: Plan, plans: Plan[]) {
  const weekly = plans.find((candidate) => candidate.plan === 'weekly');
  if (!weekly || plan.plan === 'weekly' || weekly.currency !== plan.currency) return null;
  return weekly.price * WEEKS[plan.plan];
}

/** How much less this plan costs than the weekly one over the same time, in whole percent, rounded down. */
export function planSaving(plan: Plan, plans: Plan[]) {
  const full = fullPrice(plan, plans);
  if (!full) return 0;
  return Math.max(0, Math.floor((1 - plan.price / full) * 100));
}

export function perMonth(plan: Plan) {
  return plan.price / MONTHS[plan.plan];
}

/**
 * A price in the store's currency, laid out for your language and the phone's
 * region, like "CHF 15.00". Falls back to "CHF 15.00" where Intl can't.
 */
export function formatMoney(amount: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
