import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { mutation, query, type QueryCtx } from './_generated/server';
import { requireUserId } from './lib/auth';
import { fail } from './lib/errors';
import { personCard } from './lib/people';
import { rateLimit } from './lib/rateLimit';
import { reportReason } from './schema';

/** Someone else's account, from an id the app sends. Never yourself. */
async function requireOtherUser(ctx: QueryCtx, me: Id<'users'>, userId: string) {
  const id = ctx.db.normalizeId('users', userId);
  if (!id || !(await ctx.db.get(id))) fail("That person doesn't exist.");
  if (id === me) fail("You can't do that to yourself.");
  return id;
}

/** The people you blocked, most recent first: the `BlockedPerson` shape. */
export const listBlocked = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const blocks = await ctx.db
      .query('blocks')
      .withIndex('by_blocker', (q) => q.eq('blockerId', userId))
      .order('desc')
      .collect();
    return await Promise.all(
      blocks.map(async (block) => {
        const person = await personCard(ctx, block.blockedId, 1);
        return {
          id: person.id,
          name: person.name,
          age: person.age,
          photo: person.photos[0] ?? '',
          blockedAt: new Date(block.createdAt).toISOString(),
        };
      }),
    );
  },
});

/** Blocked people are never put in your rooms again and can't message you. */
export const block = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUserId(ctx);
    await rateLimit(ctx, `block:${me}`, 30, 60 * 60_000);
    const blockedId = await requireOtherUser(ctx, me, args.userId);
    const existing = await ctx.db
      .query('blocks')
      .withIndex('by_pair', (q) => q.eq('blockerId', me).eq('blockedId', blockedId))
      .first();
    if (!existing) await ctx.db.insert('blocks', { blockerId: me, blockedId, createdAt: Date.now() });
  },
});

export const unblock = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUserId(ctx);
    const blockedId = ctx.db.normalizeId('users', args.userId);
    if (!blockedId) return;
    const rows = await ctx.db
      .query('blocks')
      .withIndex('by_pair', (q) => q.eq('blockerId', me).eq('blockedId', blockedId))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
  },
});

/** Reports land in the `reports` table for someone on the team to review. */
export const report = mutation({
  args: { userId: v.string(), reason: reportReason, details: v.optional(v.string()) },
  handler: async (ctx, { userId, reason, details }) => {
    const me = await requireUserId(ctx);
    await rateLimit(ctx, `report:${me}`, 10, 60 * 60_000);
    const reportedId = await requireOtherUser(ctx, me, userId);
    const note = details?.trim();
    if (note && note.length > 1000) fail('Keep the details under 1000 characters.');
    await ctx.db.insert('reports', {
      reporterId: me,
      reportedId,
      reason,
      details: note || undefined,
      createdAt: Date.now(),
    });
  },
});
