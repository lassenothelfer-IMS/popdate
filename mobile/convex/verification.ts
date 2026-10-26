import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { internalMutation, mutation, query } from './_generated/server';
import { requireUserId } from './lib/auth';
import { rateLimit } from './lib/rateLimit';
import { claimImage, deleteImage } from './lib/uploads';

/** Your selfie verification: `none`, `pending`, `verified` or `rejected`. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const row = userId
      ? await ctx.db
          .query('verifications')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .unique()
      : null;
    return row?.status ?? 'none';
  },
});

/**
 * Sends an uploaded selfie for review. The selfie is never shown to other
 * players; someone on the team approves it with `verification:review`.
 */
export const submitSelfie = mutation({
  args: { selfie: v.id('_storage') },
  handler: async (ctx, { selfie }) => {
    const userId = await requireUserId(ctx);
    await rateLimit(ctx, `selfie:${userId}`, 5, 60 * 60_000);
    await claimImage(ctx, userId, selfie);

    const row = await ctx.db
      .query('verifications')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (row?.status === 'verified') {
      await deleteImage(ctx, selfie);
      return 'verified' as const;
    }
    if (row) {
      await deleteImage(ctx, row.selfie);
      await ctx.db.patch(row._id, { status: 'pending', selfie, submittedAt: Date.now() });
    } else {
      await ctx.db.insert('verifications', {
        userId,
        status: 'pending',
        selfie,
        submittedAt: Date.now(),
      });
    }
    return 'pending' as const;
  },
});

/**
 * For the team, from the Convex dashboard or the CLI:
 * `npx convex run verification:review '{"userId": "...", "status": "verified"}'`
 */
export const review = internalMutation({
  args: { userId: v.id('users'), status: v.union(v.literal('verified'), v.literal('rejected')) },
  handler: async (ctx, { userId, status }) => {
    const row = await ctx.db
      .query('verifications')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (row) await ctx.db.patch(row._id, { status });
  },
});
