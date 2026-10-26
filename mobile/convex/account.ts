import type { Id } from './_generated/dataModel';
import { mutation, type MutationCtx } from './_generated/server';
import { requireUserId } from './lib/auth';
import { activeRoomOf, getProfile } from './lib/people';
import { leave } from './lib/room';
import { deleteImage } from './lib/uploads';
import { removeFromQueue } from './queue';

/** Takes you out of the queue and out of a room you're still playing in. */
async function stepOut(ctx: MutationCtx, userId: Id<'users'>) {
  await removeFromQueue(ctx, userId);
  const room = await activeRoomOf(ctx, userId);
  if (room) await leave(ctx, room, userId);
}

/**
 * Runs before the app signs out. A test account is anonymous: once signed out
 * nobody can come back to it, so it shouldn't keep waiting in a queue or a room.
 */
export const prepareSignOut = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await stepOut(ctx, userId);
  },
});

/**
 * Deletes the account: profile, photos, selfie, settings, push tokens, blocks,
 * matches and their messages, and the sign-in records. Apple requires this in the app.
 * Rooms you played stay for the other players, showing you as "Someone". Reports
 * about you stay, so the team can still act on them.
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

    for (const table of ['settings', 'pushTokens'] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .collect();
      for (const row of rows) await ctx.db.delete(row._id);
    }

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
    for (const match of matches) {
      const messages = await ctx.db
        .query('messages')
        .withIndex('by_match', (q) => q.eq('matchId', match._id))
        .collect();
      for (const message of messages) await ctx.db.delete(message._id);
      await ctx.db.delete(match._id);
    }

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
