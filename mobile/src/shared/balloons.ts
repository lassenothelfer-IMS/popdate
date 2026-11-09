/**
 * Balloons: what a room costs. Shared by the app, the mock and the server
 * (`convex/lib/balloons.ts`). Relative imports only: Convex bundles this file
 * without the app's `@/` alias.
 *
 * The rules:
 * - Joining the line needs at least one balloon.
 * - You lose one only when yours gets popped (or you leave while still holding it).
 *   Winning keeps it, and the chooser never pays. A pop doesn't cost anyone who
 *   never answered in that room: they may not have been there at all.
 * - Free balloons top back up to FREE_BALLOONS every day (UTC midnight, 1:00 or
 *   2:00 in Zurich). Bought ones never expire and are spent after the free ones.
 * - Popdate+ means unlimited: nothing is spent.
 */

/** Free balloons each day. A refill tops up to this, never past it. */
export const FREE_BALLOONS = 3;
/** Extra balloons a new account starts with, on top of the day's free ones. */
export const STARTER_BALLOONS = 2;

/**
 * The balloon packs on sale, by store product id, and how many balloons each
 * adds. The same ids have to exist in App Store Connect and in RevenueCat.
 */
export const BALLOON_PACKS: Record<string, number> = {
  'popdate.balloons.5': 5,
  'popdate.balloons.15': 15,
};

/** What joining the line fails with when you have none; the app recognizes it. */
export const NO_BALLOONS = 'No balloons left.';

/** The RevenueCat entitlement that means Popdate+. */
export const PLUS_ENTITLEMENT = 'plus';

/** What the server stores per player. */
export type BalloonWallet = {
  /** Today's free balloons left. */
  free: number;
  /** Bought (and starter) balloons left. */
  extra: number;
  /** The UTC day the free ones were last topped up, as YYYY-MM-DD. */
  refillDay: string;
  /** Popdate+ runs until then, in epoch ms. Missing or past: no Popdate+. */
  plusUntil?: number;
};

/** What a player sees: the `Balloons` shape in `src/api/types.ts`. */
export type BalloonsView = {
  free: number;
  extra: number;
  /** Unlimited, through Popdate+. */
  plus: boolean;
  /** When the free ones top up next, in epoch ms. */
  refillsAt: number;
};

export function dayKey(now: number) {
  return new Date(now).toISOString().slice(0, 10);
}

export function nextRefillAt(now: number) {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
}

export function newWallet(now: number): BalloonWallet {
  return { free: FREE_BALLOONS, extra: STARTER_BALLOONS, refillDay: dayKey(now) };
}

/** The wallet as of `now`: on a new day the free balloons are back. */
export function refilled(wallet: BalloonWallet, now: number): BalloonWallet {
  const today = dayKey(now);
  if (wallet.refillDay === today) return wallet;
  return { ...wallet, free: Math.max(wallet.free, FREE_BALLOONS), refillDay: today };
}

export function hasPlus(wallet: BalloonWallet, now: number) {
  return (wallet.plusUntil ?? 0) > now;
}

/** Whether you can join the line. */
export function canPlay(wallet: BalloonWallet, now: number) {
  const current = refilled(wallet, now);
  return hasPlus(current, now) || current.free + current.extra > 0;
}

/** Your balloon popped: one less, the free ones first. Popdate+ spends nothing; never below zero. */
export function spend(wallet: BalloonWallet, now: number): BalloonWallet {
  const current = refilled(wallet, now);
  if (hasPlus(current, now)) return current;
  if (current.free > 0) return { ...current, free: current.free - 1 };
  if (current.extra > 0) return { ...current, extra: current.extra - 1 };
  return current;
}

/** A bought pack lands. */
export function credit(wallet: BalloonWallet, count: number, now: number): BalloonWallet {
  return { ...refilled(wallet, now), extra: wallet.extra + count };
}

export function viewOf(wallet: BalloonWallet, now: number): BalloonsView {
  const current = refilled(wallet, now);
  return {
    free: current.free,
    extra: current.extra,
    plus: hasPlus(current, now),
    refillsAt: nextRefillAt(now),
  };
}

/**
 * How many balloons a view stands for at `now`, or null for unlimited. The view
 * comes from the server and can be older than midnight: past `refillsAt`, the
 * free ones count as topped up, as the server will see them.
 */
export function balloonCount(view: BalloonsView, now: number): number | null {
  if (view.plus) return null;
  const free = now >= view.refillsAt ? Math.max(view.free, FREE_BALLOONS) : view.free;
  return free + view.extra;
}
