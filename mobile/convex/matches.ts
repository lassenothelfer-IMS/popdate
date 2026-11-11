import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { requireUserId } from './lib/auth';
import { ageFromBirthDate, getProfile, isBlockedEitherWay, personCard, photoUrls } from './lib/people';
import { deleteImage } from './lib/uploads';

function otherOf(match: Doc<'matches'>, viewerId: Id<'users'>) {
  return match.popperId === viewerId ? match.winnerId : match.popperId;
}

/** A match as you see it: the `Match` shape in `src/api/types.ts`. */
async function matchView(ctx: QueryCtx, match: Doc<'matches'>, viewerId: Id<'users'>) {
  const otherId = otherOf(match, viewerId);
  const other = await personCard(ctx, otherId, 1);
  return {
    id: match._id as string,
    roomId: match.roomId as string,
    other: { id: other.id, name: other.name, age: other.age, photo: other.photos[0] ?? '' },
    createdAt: new Date(match.createdAt).toISOString(),
  };
}

/** Your matches, newest first. A block, either way, hides the match until it's lifted. */
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
    const visible = [];
    for (const match of all) {
      if (!(await isBlockedEitherWay(ctx, userId, otherOf(match, userId)))) visible.push(match);
    }
    return await Promise.all(visible.map((match) => matchView(ctx, match, userId)));
  },
});

/** How many of the newest messages an ended chat keeps for reports. */
const KEPT_FOR_REPORTS = 200;
/** How long an ended chat's last messages are kept for reports. */
export const ENDED_CHAT_DAYS = 30;
/** Messages deleted per batch, far below Convex's per-mutation limits. */
const PURGE_BATCH = 500;

/** The two ids of a pair in a fixed order, for `endedChats`. */
export function pairOf(a: Id<'users'>, b: Id<'users'>): [Id<'users'>, Id<'users'>] {
  return a < b ? [a, b] : [b, a];
}

/**
 * Ends a match for both people. The match goes now, which closes the chat at once;
 * its last messages are kept 30 days for reports, and the messages themselves are
 * deleted in batches afterwards, so a long chat never runs into Convex's limits.
 */
export async function endMatch(ctx: MutationCtx, match: Doc<'matches'>) {
  const newest = await ctx.db
    .query('messages')
    .withIndex('by_match', (q) => q.eq('matchId', match._id))
    .order('desc')
    .take(KEPT_FOR_REPORTS);
  if (newest.length > 0) {
    const [aId, bId] = pairOf(match.popperId, match.winnerId);
    await ctx.db.insert('endedChats', {
      aId,
      bId,
      // A recording isn't kept: the report shows that there was one.
      messages: newest.reverse().map((m) => ({
        senderId: m.senderId,
        text: m.voice ? '(voice message)' : m.text,
        sentAt: m.sentAt,
      })),
      endedAt: Date.now(),
    });
  }
  await ctx.db.delete(match._id);
  await ctx.scheduler.runAfter(0, internal.matches.purgeMessages, { matchId: match._id });
}

/** Ends a match for both people: the match and its messages are deleted. */
export const unmatch = mutation({
  args: { matchId: v.string() },
  handler: async (ctx, { matchId }) => {
    const userId = await requireUserId(ctx);
    const id = ctx.db.normalizeId('matches', matchId);
    const match = id ? await ctx.db.get(id) : null;
    if (!match || (match.popperId !== userId && match.winnerId !== userId)) return;
    await endMatch(ctx, match);
  },
});

/** Deletes an ended match's messages, a batch at a time. */
export const purgeMessages = internalMutation({
  args: { matchId: v.id('matches') },
  handler: async (ctx, { matchId }) => {
    const batch = await ctx.db
      .query('messages')
      .withIndex('by_match', (q) => q.eq('matchId', matchId))
      .take(PURGE_BATCH);
    for (const message of batch) {
      // A voice message's recording goes with it.
      if (message.voice) await deleteImage(ctx, message.voice.storageId);
      await ctx.db.delete(message._id);
    }
    if (batch.length === PURGE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.matches.purgeMessages, { matchId });
    }
  },
});

/** Daily (`crons.ts`): ended chats kept for reports go after 30 days. */
export const purgeEndedChats = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - ENDED_CHAT_DAYS * 24 * 60 * 60_000;
    const old = await ctx.db
      .query('endedChats')
      .withIndex('by_ended', (q) => q.lt('endedAt', cutoff))
      .take(200);
    for (const row of old) await ctx.db.delete(row._id);
    if (old.length === 200) await ctx.scheduler.runAfter(0, internal.matches.purgeEndedChats, {});
  },
});

/**
 * The full profile of the person you matched with, and the room you matched in:
 * the `MatchProfile` shape in `src/api/types.ts`. Only for the two of a match,
 * and gone with the match or behind a block.
 */
export const profile = query({
  args: { matchId: v.string() },
  handler: async (ctx, { matchId }) => {
    const userId = await getAuthUserId(ctx);
    const id = ctx.db.normalizeId('matches', matchId);
    const match = userId && id ? await ctx.db.get(id) : null;
    if (!userId || !match) return null;
    if (match.popperId !== userId && match.winnerId !== userId) return null;
    const otherId = otherOf(match, userId);
    if (await isBlockedEitherWay(ctx, userId, otherId)) return null;
    const [theirs, room, verification] = await Promise.all([
      getProfile(ctx, otherId),
      ctx.db.get(match.roomId),
      ctx.db
        .query('verifications')
        .withIndex('by_user', (q) => q.eq('userId', otherId))
        .first(),
    ]);
    if (!theirs) return null;
    // The answers are the balloon's: the match's winner, who is the room's winner or, after a second chance, its runner-up.
    const rounds = room
      ? await Promise.all(
          room.usedQuestionIds.map(async (questionId, index) => {
            const question = await ctx.db.get(questionId);
            const answers = await ctx.db
              .query('answers')
              .withIndex('by_room_round', (q) => q.eq('roomId', room._id).eq('round', index + 1))
              .collect();
            const answer = answers.find((given) => given.userId === match.winnerId);
            return { round: index + 1, question: question?.text ?? '', answer: answer?.text ?? null };
          }),
        )
      : [];
    return {
      id: otherId as string,
      name: theirs.name,
      age: ageFromBirthDate(theirs.birthDate),
      gender: theirs.gender,
      genderIdentity: theirs.genderIdentity,
      sexuality: theirs.sexuality,
      city: theirs.city,
      job: theirs.job,
      bio: theirs.bio,
      heightCm: theirs.heightCm ?? null,
      photos: (await photoUrls(ctx, theirs.photos)).filter(Boolean),
      verified: verification?.status === 'verified',
      role: match.popperId === otherId ? ('popper' as const) : ('contestant' as const),
      rounds,
      wonInRound:
        room && room.winnerId === match.winnerId
          ? (rounds.findLast((round) => round.answer !== null)?.round ?? null)
          : null,
    };
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
    if (await isBlockedEitherWay(ctx, userId, otherOf(match, userId))) return null;
    return await matchView(ctx, match, userId);
  },
});
