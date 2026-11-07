import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { mutation, query, type QueryCtx } from './_generated/server';
import { requireUserId } from './lib/auth';
import { fail } from './lib/errors';
import { personCard } from './lib/people';
import { pairOf } from './matches';
import { rateLimit } from './lib/rateLimit';
import { reportReason } from './schema';

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
        // Blocked back: their photo stays hidden from you too.
        const blockedBack = await ctx.db
          .query('blocks')
          .withIndex('by_pair', (q) => q.eq('blockerId', block.blockedId).eq('blockedId', userId))
          .first();
        const person = await personCard(ctx, block.blockedId, blockedBack ? 0 : 1);
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
    const blockedId = ctx.db.normalizeId('users', args.userId);
    if (!blockedId) fail("That person doesn't exist.");
    if (blockedId === me) fail("You can't do that to yourself.");
    // A deleted account: its blocks are gone and its id never comes back, so nothing to do.
    if (!(await ctx.db.get(blockedId))) return;
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

/** How many of the newest messages a report copies. */
const REPORT_TRANSCRIPT = 200;

/**
 * The newest messages between two people, for a report: from your live chat, or
 * from one that ended in the last 30 days (unmatched, or their account deleted).
 */
async function transcriptBetween(ctx: QueryCtx, me: Id<'users'>, other: Id<'users'>) {
  const asPopper = await ctx.db
    .query('matches')
    .withIndex('by_popper', (q) => q.eq('popperId', me))
    .collect();
  const asWinner = await ctx.db
    .query('matches')
    .withIndex('by_winner', (q) => q.eq('winnerId', me))
    .collect();
  const lines: { senderId: Id<'users'>; text: string; sentAt: number }[] = [];
  // Every chat the two had: live ones (they may have matched again) and ended ones.
  for (const match of [...asPopper, ...asWinner]) {
    if (match.popperId !== other && match.winnerId !== other) continue;
    const newest = await ctx.db
      .query('messages')
      .withIndex('by_match', (q) => q.eq('matchId', match._id))
      .order('desc')
      .take(REPORT_TRANSCRIPT);
    lines.push(...newest.map((m) => ({ senderId: m.senderId, text: m.text, sentAt: m.sentAt })));
  }
  const [aId, bId] = pairOf(me, other);
  const ended = await ctx.db
    .query('endedChats')
    .withIndex('by_pair', (q) => q.eq('aId', aId).eq('bId', bId))
    .collect();
  for (const chat of ended) lines.push(...chat.messages);
  return lines.sort((x, y) => x.sentAt - y.sentAt).slice(-REPORT_TRANSCRIPT);
}

/**
 * Reports land in the `reports` table for someone on the team to review, with the
 * newest messages between you. Someone whose account is gone can still be reported.
 */
export const report = mutation({
  args: { userId: v.string(), reason: reportReason, details: v.optional(v.string()) },
  handler: async (ctx, { userId, reason, details }) => {
    const me = await requireUserId(ctx);
    await rateLimit(ctx, `report:${me}`, 10, 60 * 60_000);
    const reportedId = ctx.db.normalizeId('users', userId);
    if (!reportedId) fail("That person doesn't exist.");
    if (reportedId === me) fail("You can't do that to yourself.");
    const note = details?.trim();
    if (note && note.length > 1000) fail('Keep the details under 1000 characters.');
    const transcript = await transcriptBetween(ctx, me, reportedId);
    await ctx.db.insert('reports', {
      reporterId: me,
      reportedId,
      reason,
      details: note || undefined,
      transcript: transcript && transcript.length > 0 ? transcript : undefined,
      createdAt: Date.now(),
    });
  },
});
