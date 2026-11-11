import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import {
  internalAction,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import { requireUserId } from './lib/auth';
import { fail } from './lib/errors';
import { MAX_MESSAGE_LENGTH } from './lib/game';
import { getProfile, isBlockedEitherWay } from './lib/people';
import { maskProfanity } from './lib/profanity';
import { rateLimit } from './lib/rateLimit';
import { claimAudio } from './lib/uploads';
import { schedulePush } from './push';
import {
  fetchLinkPreview,
  firstUrl,
  isReaction,
  MAX_VOICE_MS,
  MIN_VOICE_MS,
  NUDGE_AFTER_MS,
  VOICE_BARS,
} from '../src/shared/chat';

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

function otherOf(match: Doc<'matches'>, userId: Id<'users'>) {
  return match.popperId === userId ? match.winnerId : match.popperId;
}

async function messageView(ctx: QueryCtx, message: Doc<'messages'>) {
  const url = message.voice ? await ctx.storage.getUrl(message.voice.storageId) : null;
  return {
    id: message._id as string,
    matchId: message.matchId as string,
    senderId: message.senderId as string,
    text: message.text,
    sentAt: new Date(message.sentAt).toISOString(),
    replyTo: (message.replyTo as string | undefined) ?? null,
    reactions: (message.reactions ?? []).map((reaction) => ({
      userId: reaction.userId as string,
      emoji: reaction.emoji,
    })),
    link: message.link ?? null,
    voice:
      message.voice && url
        ? { url, durationMs: message.voice.durationMs, waveform: message.voice.waveform }
        : null,
  };
}

/** How many of the newest messages the chat loads. */
const CHAT_LIMIT = 200;

/** The newest messages of the chat, oldest first, live. */
export const list = query({
  args: { matchId: v.string() },
  handler: async (ctx, { matchId }) => {
    const { userId, match } = await requireMyMatch(ctx, matchId);
    if (await isBlockedEitherWay(ctx, userId, otherOf(match, userId))) return [];
    const newest = await ctx.db
      .query('messages')
      .withIndex('by_match', (q) => q.eq('matchId', match._id))
      .order('desc')
      .take(CHAT_LIMIT);
    return await Promise.all(newest.reverse().map((message) => messageView(ctx, message)));
  },
});

async function typingRow(ctx: QueryCtx, matchId: Id<'matches'>, userId: Id<'users'>) {
  return await ctx.db
    .query('typing')
    .withIndex('by_match_user', (q) => q.eq('matchId', matchId).eq('userId', userId))
    .unique();
}

type Voice = { storageId: Id<'_storage'>; durationMs: number; waveform: number[] };

/**
 * Puts one message into a chat you are part of: its text, or a voice message.
 * Shared by `send` and `sendVoice`, so both check and notify the same way.
 */
async function post(
  ctx: MutationCtx,
  { matchId, text, voice, replyTo }: { matchId: string; text: string; voice?: Voice; replyTo?: string },
) {
  const { userId, match } = await requireMyMatch(ctx, matchId);
  await rateLimit(ctx, `sendMessage:${userId}`, 30, 60_000);
  const otherId = otherOf(match, userId);
  if (await isBlockedEitherWay(ctx, userId, otherId)) {
    fail("You can't message this person anymore.");
  }
  if (voice) await claimAudio(ctx, userId, voice.storageId);

  // A reply answers a message of this same chat; anything else is sent as a plain message.
  const targetId = replyTo ? ctx.db.normalizeId('messages', replyTo) : null;
  const target = targetId ? await ctx.db.get(targetId) : null;
  const answers = target && target.matchId === match._id ? target._id : undefined;

  const sender = await getProfile(ctx, userId);
  await schedulePush(ctx, [otherId], {
    kind: 'messages',
    title: sender?.name ?? 'New message',
    body: voice ? 'Voice message' : text.slice(0, 140),
    data: { type: 'chat', matchId: match._id },
  });
  const sentAt = Date.now();
  const id = await ctx.db.insert('messages', {
    matchId: match._id,
    senderId: userId,
    text,
    sentAt,
    replyTo: answers,
    voice,
  });
  // Whose turn it is now, for the "your turn" nudge; and you have stopped typing.
  await ctx.db.patch(match._id, { lastMessageAt: sentAt, lastSenderId: userId });
  const typing = await typingRow(ctx, match._id, userId);
  if (typing) await ctx.db.delete(typing._id);
  return id;
}

export const send = mutation({
  args: { matchId: v.string(), text: v.string(), replyTo: v.optional(v.string()) },
  handler: async (ctx, { matchId, text, replyTo }) => {
    const trimmed = text.trim();
    if (!trimmed) fail('Write something first.');
    if (trimmed.length > MAX_MESSAGE_LENGTH) fail('That message is too long.');
    // The server's own filter: the worst words never reach anyone.
    const id = await post(ctx, { matchId, text: maskProfanity(trimmed), replyTo });
    const url = firstUrl(trimmed);
    if (url) await ctx.scheduler.runAfter(0, internal.chat.previewLink, { messageId: id, url });
    return await messageView(ctx, (await ctx.db.get(id))!);
  },
});

/**
 * Sends a recording as a voice message. The app uploads the audio first (the
 * same upload URL as photos) and passes its storage id.
 */
export const sendVoice = mutation({
  args: {
    matchId: v.string(),
    storageId: v.id('_storage'),
    durationMs: v.number(),
    waveform: v.array(v.number()),
    replyTo: v.optional(v.string()),
  },
  handler: async (ctx, { matchId, storageId, durationMs, waveform, replyTo }) => {
    if (!Number.isFinite(durationMs) || durationMs < MIN_VOICE_MS) fail('That voice message is too short.');
    // A second of slack: the recorder stops a moment after the limit.
    if (durationMs > MAX_VOICE_MS + 1000) fail('That voice message is too long.');
    const bars = waveform
      .slice(0, VOICE_BARS)
      .map((level) => (Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0));
    const id = await post(ctx, {
      matchId,
      text: '',
      voice: { storageId, durationMs: Math.round(durationMs), waveform: bars },
      replyTo,
    });
    return await messageView(ctx, (await ctx.db.get(id))!);
  },
});

/** Reacts to a message with one of the chat's reactions, or takes your reaction back with `null`. */
export const react = mutation({
  args: { matchId: v.string(), messageId: v.string(), emoji: v.union(v.string(), v.null()) },
  handler: async (ctx, { matchId, messageId, emoji }) => {
    const { userId, match } = await requireMyMatch(ctx, matchId);
    await rateLimit(ctx, `react:${userId}`, 60, 60_000);
    if (await isBlockedEitherWay(ctx, userId, otherOf(match, userId))) {
      fail("You can't message this person anymore.");
    }
    if (emoji !== null && !isReaction(emoji)) fail("That reaction doesn't exist.");
    const id = ctx.db.normalizeId('messages', messageId);
    const message = id ? await ctx.db.get(id) : null;
    if (!message || message.matchId !== match._id) fail("This message doesn't exist.");
    const others = (message.reactions ?? []).filter((reaction) => reaction.userId !== userId);
    await ctx.db.patch(message._id, {
      reactions: emoji === null ? others : [...others, { userId, emoji }],
    });
  },
});

/** Says you are typing in this chat right now. The app repeats it while you type. */
export const typing = mutation({
  args: { matchId: v.string() },
  handler: async (ctx, { matchId }) => {
    const { userId, match } = await requireMyMatch(ctx, matchId);
    const row = await typingRow(ctx, match._id, userId);
    if (row) await ctx.db.patch(row._id, { at: Date.now() });
    else await ctx.db.insert('typing', { matchId: match._id, userId, at: Date.now() });
  },
});

/**
 * When the other person last typed in this chat, as a timestamp, or null. The app
 * shows "typing" for a few seconds after it: a query can't tick by itself.
 */
export const typingOf = query({
  args: { matchId: v.string() },
  handler: async (ctx, { matchId }) => {
    const { userId, match } = await requireMyMatch(ctx, matchId);
    const otherId = otherOf(match, userId);
    if (await isBlockedEitherWay(ctx, userId, otherId)) return null;
    return (await typingRow(ctx, match._id, otherId))?.at ?? null;
  },
});

/** Reads a shared link's page and lays its preview under the message. A link that can't be read stays plain. */
export const previewLink = internalAction({
  args: { messageId: v.id('messages'), url: v.string() },
  handler: async (ctx, { messageId, url }) => {
    const link = await fetchLinkPreview(url);
    if (link) await ctx.runMutation(internal.chat.setLink, { messageId, link });
  },
});

export const setLink = internalMutation({
  args: {
    messageId: v.id('messages'),
    link: v.object({
      url: v.string(),
      title: v.string(),
      description: v.optional(v.string()),
      image: v.optional(v.string()),
      site: v.string(),
    }),
  },
  handler: async (ctx, { messageId, link }) => {
    if (await ctx.db.get(messageId)) await ctx.db.patch(messageId, { link });
  },
});

/** How many waiting chats one run of the nudge looks at. */
const NUDGE_BATCH = 200;

/**
 * "Your turn": once a message has waited a day for its answer, the person it
 * waits on gets one push. One per waiting message, never again for the same one.
 */
export const nudgeYourTurn = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const waiting = await ctx.db
      .query('matches')
      .withIndex('by_last_message', (q) =>
        q.gt('lastMessageAt', now - 2 * NUDGE_AFTER_MS).lt('lastMessageAt', now - NUDGE_AFTER_MS),
      )
      .take(NUDGE_BATCH);
    for (const match of waiting) {
      await nudge(ctx, match, now);
    }
  },
});

async function nudge(ctx: MutationCtx, match: Doc<'matches'>, now: number) {
  const { lastMessageAt, lastSenderId } = match;
  if (!lastMessageAt || !lastSenderId) return;
  if (match.nudgedAt && match.nudgedAt >= lastMessageAt) return;
  const waitingOn = otherOf(match, lastSenderId);
  await ctx.db.patch(match._id, { nudgedAt: now });
  if (await isBlockedEitherWay(ctx, lastSenderId, waitingOn)) return;
  const sender = await getProfile(ctx, lastSenderId);
  if (!sender) return;
  await schedulePush(ctx, [waitingOn], {
    kind: 'messages',
    title: 'Your turn',
    body: `${sender.name} wrote to you yesterday.`,
    data: { type: 'chat', matchId: match._id },
  });
}
