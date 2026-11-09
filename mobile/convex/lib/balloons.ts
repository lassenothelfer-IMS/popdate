import {
  canPlay,
  credit,
  newWallet,
  spend,
  viewOf,
  type BalloonWallet,
} from '../../src/shared/balloons';
import { internal } from '../_generated/api';
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
 * Without RevenueCat's own answer (`http.ts` asks it when it has a secret key),
 * the end date stored for the old account is moved. That one may be gone: deleting
 * an account keeps the Popdate+ end date for exactly this.
 */
export async function transferPlus(ctx: MutationCtx, from: Id<'users'>, to: Id<'users'>, eventAt: number) {
  const source = await walletRow(ctx, from);
  if (!source?.plusUntil || source.plusUntil <= Date.now()) return false;
  await setPlusUntil(ctx, to, source.plusUntil, eventAt);
  await setPlusUntil(ctx, from, Date.now(), eventAt);
  await forgetIfDeleted(ctx, from);
  return true;
}

/**
 * For deleting an account. A Popdate+ subscription keeps billing through Apple,
 * and RevenueCat can move it to a new account later (TRANSFER), so while it runs
 * only its end date stays, with no balloons and nothing else about the person.
 */
export async function deleteWallet(ctx: MutationCtx, userId: Id<'users'>) {
  const row = await walletRow(ctx, userId);
  if (!row) return;
  if (row.plusUntil && row.plusUntil > Date.now()) {
    await ctx.db.patch(row._id, { free: 0, extra: 0, updatedAt: Date.now() });
    // Gone once it runs out, whether or not RevenueCat says so.
    await ctx.scheduler.runAt(row.plusUntil, internal.balloons.forgetDeletedWallet, { userId });
  } else {
    await ctx.db.delete(row._id);
  }
}

/**
 * A Popdate+ event for a deleted account whose end date is kept: it follows
 * renewals, so a later restore moves the right date, and goes once Popdate+ ends.
 * Never creates a row, and never credits anything else. False without a kept row.
 */
export async function updateKeptPlus(ctx: MutationCtx, userId: Id<'users'>, until: number, eventAt: number) {
  const row = await walletRow(ctx, userId);
  if (!row) return false;
  await setPlusUntil(ctx, userId, until, eventAt);
  const kept = await walletRow(ctx, userId);
  if (kept && (kept.plusUntil ?? 0) <= Date.now()) await ctx.db.delete(kept._id);
  else if (kept?.plusUntil) {
    await ctx.scheduler.runAt(kept.plusUntil, internal.balloons.forgetDeletedWallet, { userId });
  }
  return true;
}

/** A wallet kept only for a deleted account's Popdate+ goes once that's settled. */
export async function forgetIfDeleted(ctx: MutationCtx, userId: Id<'users'>) {
  if (await ctx.db.get(userId)) return;
  const row = await walletRow(ctx, userId);
  if (row) await ctx.db.delete(row._id);
}

/** Sets Popdate+ from RevenueCat's own answer, for an account that may be deleted. */
export async function setPlusFromRevenueCat(
  ctx: MutationCtx,
  userId: Id<'users'>,
  until: number,
  eventAt: number,
) {
  await setPlusUntil(ctx, userId, until, eventAt);
  await forgetIfDeleted(ctx, userId);
}
