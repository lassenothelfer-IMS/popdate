import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { query, type QueryCtx } from './_generated/server';
import { personCard } from './lib/people';

/** A match as you see it: the `Match` shape in `src/api/types.ts`. */
async function matchView(ctx: QueryCtx, match: Doc<'matches'>, viewerId: Id<'users'>) {
  const otherId = match.popperId === viewerId ? match.winnerId : match.popperId;
  const other = await personCard(ctx, otherId, 1);
  return {
    id: match._id as string,
    roomId: match.roomId as string,
    other: { id: other.id, name: other.name, age: other.age, photo: other.photos[0] ?? '' },
    createdAt: new Date(match.createdAt).toISOString(),
  };
}

/** Your matches, newest first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const [asPopper, asWinner] = await Promise.all([
      ctx.db
        .query('matches')
        .withIndex('by_popper', (q) => q.eq('popperId', userId))
        .collect(),
      ctx.db
        .query('matches')
        .withIndex('by_winner', (q) => q.eq('winnerId', userId))
        .collect(),
    ]);
    const all = [...asPopper, ...asWinner].sort((a, b) => b.createdAt - a.createdAt);
    return await Promise.all(all.map((match) => matchView(ctx, match, userId)));
  },
});

/** One of your matches, or null if it doesn't exist or isn't yours. */
export const get = query({
  args: { matchId: v.string() },
  handler: async (ctx, { matchId }) => {
    const userId = await getAuthUserId(ctx);
    const id = ctx.db.normalizeId('matches', matchId);
    const match = userId && id ? await ctx.db.get(id) : null;
    if (!userId || !match) return null;
    if (match.popperId !== userId && match.winnerId !== userId) return null;
    return await matchView(ctx, match, userId);
  },
});
