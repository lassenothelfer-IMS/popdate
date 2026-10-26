import { v } from 'convex/values';

import type { Doc } from './_generated/dataModel';
import { mutation, query, type QueryCtx } from './_generated/server';
import { requireUserId } from './lib/auth';
import { fail } from './lib/errors';
import { MAX_MESSAGE_LENGTH } from './lib/game';
import { isBlockedEitherWay } from './lib/people';
import { maskProfanity } from './lib/profanity';
import { rateLimit } from './lib/rateLimit';

/** A match you are part of. Only the popper and the winner of a match can read or write its chat. */
async function requireMyMatch(ctx: QueryCtx, matchId: string) {
  const userId = await requireUserId(ctx);
  const id = ctx.db.normalizeId('matches', matchId);
  const match = id ? await ctx.db.get(id) : null;
  if (!match || (match.popperId !== userId && match.winnerId !== userId)) {
    fail("This match doesn't exist.");
  }
  return { userId, match };
}

function messageView(message: Doc<'messages'>) {
  return {
    id: message._id as string,
    matchId: message.matchId as string,
    senderId: message.senderId as string,
    text: message.text,
    sentAt: new Date(message.sentAt).toISOString(),
  };
}

/** The chat, oldest first, live. */
export const list = query({
  args: { matchId: v.string() },
  handler: async (ctx, { matchId }) => {
    const { match } = await requireMyMatch(ctx, matchId);
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_match', (q) => q.eq('matchId', match._id))
      .collect();
    return messages.map(messageView);
  },
});

export const send = mutation({
  args: { matchId: v.string(), text: v.string() },
  handler: async (ctx, { matchId, text }) => {
    const { userId, match } = await requireMyMatch(ctx, matchId);
    await rateLimit(ctx, `sendMessage:${userId}`, 30, 60_000);
    const otherId = match.popperId === userId ? match.winnerId : match.popperId;
    if (await isBlockedEitherWay(ctx, userId, otherId)) {
      fail("You can't message this person anymore.");
    }
    const trimmed = text.trim();
    if (!trimmed) fail('Write something first.');
    if (trimmed.length > MAX_MESSAGE_LENGTH) fail('That message is too long.');

    const id = await ctx.db.insert('messages', {
      matchId: match._id,
      senderId: userId,
      // The server's own filter: the worst words never reach anyone.
      text: maskProfanity(trimmed),
      sentAt: Date.now(),
    });
    return messageView((await ctx.db.get(id))!);
  },
});
