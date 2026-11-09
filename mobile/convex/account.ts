import type { Id } from './_generated/dataModel';
import { mutation, type MutationCtx } from './_generated/server';
import { endMatch } from './matches';
import { requireUserId } from './lib/auth';
import { activeRoomOf, getProfile } from './lib/people';
import { leave } from './lib/room';
import { deleteWallet } from './lib/balloons';
import { deleteImage } from './lib/uploads';
import { dropQueueRow } from './queue';

/** Takes you out of the queue and out of a room you're still playing in. */
async function stepOut(ctx: MutationCtx, userId: Id<'users'>) {
  await dropQueueRow(ctx, userId);
  const room = await activeRoomOf(ctx, userId);
  if (room) await leave(ctx, room, userId);
}

async function deletePushTokens(ctx: MutationCtx, userId: Id<'users'>) {
  const rows = await ctx.db
    .query('pushTokens')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect();
  for (const row of rows) await ctx.db.delete(row._id);
}

/**
 * Runs before the app signs out. A test account is anonymous: once signed out
 * nobody can come back to it, so it shouldn't keep waiting in a queue or a room.
 * Its push tokens go too, so this phone stops getting the old account's pushes.
 */
export const prepareSignOut = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await stepOut(ctx, userId);
    await deletePushTokens(ctx, userId);
  },
});

/**
 * Deletes the account: profile, photos, selfie, settings, answers, push tokens,
 * blocks, matches and their messages, and the sign-in records. Apple requires this
 * in the app. Rooms you played stay for the other players, showing you as
 * "Someone". Reports about you stay, so the team can still act on them, and the
 * last messages of each chat are kept 30 days so they can still be reported.
 * A running Popdate+ keeps only its end date (see `deleteWallet`).
 */
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await stepOut(ctx, userId);

    const profile = await getProfile(ctx, userId);
    if (profile) {
      for (const photo of profile.photos) await deleteImage(ctx, photo);
      await ctx.db.delete(profile._id);
    }

    const verification = await ctx.db
      .query('verifications')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (verification) {
      await deleteImage(ctx, verification.selfie);
      await ctx.db.delete(verification._id);
    }

    // Popdate+ may still be billing through Apple: its end date stays for a later transfer.
    await deleteWallet(ctx, userId);

    for (const table of ['settings', 'pushTokens', 'answers'] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .collect();
      for (const row of rows) await ctx.db.delete(row._id);
    }

    const chances = [
      ...(await ctx.db
        .query('secondChances')
        .withIndex('by_from', (q) => q.eq('fromId', userId))
        .collect()),
      ...(await ctx.db
        .query('secondChances')
        .withIndex('by_to', (q) => q.eq('toId', userId))
        .collect()),
    ];
    for (const chance of chances) await ctx.db.delete(chance._id);

    const blocks = [
      ...(await ctx.db
        .query('blocks')
        .withIndex('by_blocker', (q) => q.eq('blockerId', userId))
        .collect()),
      ...(await ctx.db
        .query('blocks')
        .withIndex('by_blocked', (q) => q.eq('blockedId', userId))
        .collect()),
    ];
    for (const block of blocks) await ctx.db.delete(block._id);

    const matches = [
      ...(await ctx.db
        .query('matches')
        .withIndex('by_popper', (q) => q.eq('popperId', userId))
        .collect()),
      ...(await ctx.db
        .query('matches')
        .withIndex('by_winner', (q) => q.eq('winnerId', userId))
        .collect()),
    ];
    // The chats go in batches after this, so a long one can't stop the deletion.
    for (const match of matches) await endMatch(ctx, match);

    // The sign-in records last, so nothing above runs without an account.
    const sessions = await ctx.db
      .query('authSessions')
      .withIndex('userId', (q) => q.eq('userId', userId))
      .collect();
    for (const session of sessions) {
      const tokens = await ctx.db
        .query('authRefreshTokens')
        .withIndex('sessionId', (q) => q.eq('sessionId', session._id))
        .collect();
      for (const token of tokens) await ctx.db.delete(token._id);
      await ctx.db.delete(session._id);
    }
    const accounts = await ctx.db
      .query('authAccounts')
      .withIndex('userIdAndProvider', (q) => q.eq('userId', userId))
      .collect();
    for (const account of accounts) await ctx.db.delete(account._id);
    await ctx.db.delete(userId);
  },
});
