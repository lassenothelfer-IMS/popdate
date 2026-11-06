import {
  canPlay,
  credit,
  newWallet,
  spend,
  viewOf,
  type BalloonWallet,
} from '../../src/shared/balloons';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

/** The rules live in `src/shared/balloons.ts`, shared with the app and the mock. */
export { BALLOON_PACKS, NO_BALLOONS, PLUS_ENTITLEMENT } from '../../src/shared/balloons';

async function walletRow(ctx: QueryCtx, userId: Id<'users'>) {
  return await ctx.db
    .query('balloons')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
}

function walletOf(row: Doc<'balloons'> | null, now: number): BalloonWallet {
  if (!row) return newWallet(now);
  return { free: row.free, extra: row.extra, refillDay: row.refillDay, plusUntil: row.plusUntil };
}

/** Writes the wallet back, creating the row on a player's first change. */
async function save(ctx: MutationCtx, userId: Id<'users'>, row: Doc<'balloons'> | null, wallet: BalloonWallet) {
  const fields = { ...wallet, updatedAt: Date.now() };
  if (row) await ctx.db.patch(row._id, fields);
  else await ctx.db.insert('balloons', { userId, ...fields });
}

/** Your balloons as you see them: the `Balloons` shape in `src/api/types.ts`. */
export async function balloonsView(ctx: QueryCtx, userId: Id<'users'>) {
  const now = Date.now();
  return viewOf(walletOf(await walletRow(ctx, userId), now), now);
}

export async function hasBalloon(ctx: QueryCtx, userId: Id<'users'>) {
  const now = Date.now();
  return canPlay(walletOf(await walletRow(ctx, userId), now), now);
}

/** Your balloon popped, or you left holding it: one less. */
export async function spendBalloon(ctx: MutationCtx, userId: Id<'users'>) {
  const now = Date.now();
  const row = await walletRow(ctx, userId);
  await save(ctx, userId, row, spend(walletOf(row, now), now));
}

export async function addBalloons(ctx: MutationCtx, userId: Id<'users'>, count: number) {
  const now = Date.now();
  const row = await walletRow(ctx, userId);
  await save(ctx, userId, row, credit(walletOf(row, now), count, now));
}

/**
 * Popdate+ runs until `until` (epoch ms); a past time ends it. `eventAt` is when
 * RevenueCat's event happened: an older event arriving late, like a retried
 * EXPIRATION after a resubscribe, changes nothing.
 */
export async function setPlusUntil(ctx: MutationCtx, userId: Id<'users'>, until: number, eventAt: number) {
  const now = Date.now();
  const row = await walletRow(ctx, userId);
  if (row?.plusEventAt !== undefined && eventAt < row.plusEventAt) return;
  const fields = { ...walletOf(row, now), plusUntil: until, plusEventAt: eventAt, updatedAt: now };
  if (row) await ctx.db.patch(row._id, fields);
  else await ctx.db.insert('balloons', { userId, ...fields });
}

/**
 * RevenueCat moved the purchases to another account (a restore on a new account,
 * which anonymous accounts make common). Popdate+ moves along; packs were used up.
 */
export async function transferPlus(ctx: MutationCtx, from: Id<'users'>, to: Id<'users'>, eventAt: number) {
  const source = await walletRow(ctx, from);
  if (!source?.plusUntil || source.plusUntil <= Date.now()) return;
  await setPlusUntil(ctx, to, source.plusUntil, eventAt);
  await setPlusUntil(ctx, from, Date.now(), eventAt);
}

/** For deleting an account. */
export async function deleteWallet(ctx: MutationCtx, userId: Id<'users'>) {
  const row = await walletRow(ctx, userId);
  if (row) await ctx.db.delete(row._id);
}
