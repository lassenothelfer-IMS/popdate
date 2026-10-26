import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import type { Doc } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { requireUserId } from './lib/auth';
import { fail } from './lib/errors';
import { rateLimit } from './lib/rateLimit';

const settingsFields = {
  language: v.union(v.literal('system'), v.literal('en'), v.literal('de'), v.literal('fr'), v.literal('it')),
  region: v.union(v.string(), v.null()),
  units: v.union(v.literal('metric'), v.literal('imperial')),
  appearance: v.union(v.literal('system'), v.literal('light'), v.literal('dark')),
  commentFilter: v.boolean(),
  notifications: v.object({ roomLive: v.boolean(), newMatch: v.boolean(), messages: v.boolean() }),
};

const DEFAULT_SETTINGS = {
  language: 'system' as const,
  region: null,
  units: 'metric' as const,
  appearance: 'system' as const,
  commentFilter: true,
  notifications: { roomLive: true, newMatch: true, messages: true },
};

function settingsView(row: Doc<'settings'>) {
  const { language, region, units, appearance, commentFilter, notifications } = row;
  return { language, region, units, appearance, commentFilter, notifications };
}

/** Your settings, or the defaults if you never changed any. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const row = userId
      ? await ctx.db
          .query('settings')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .unique()
      : null;
    return row ? settingsView(row) : DEFAULT_SETTINGS;
  },
});

export const save = mutation({
  args: settingsFields,
  handler: async (ctx, settings) => {
    const userId = await requireUserId(ctx);
    await rateLimit(ctx, `saveSettings:${userId}`, 60, 60_000);
    if (settings.region !== null && !/^[A-Z]{2}$/.test(settings.region)) {
      fail('That region is not a country code.');
    }
    const row = await ctx.db
      .query('settings')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (row) await ctx.db.replace(row._id, { userId, ...settings });
    else await ctx.db.insert('settings', { userId, ...settings });
    return settings;
  },
});

/** Saves this phone's Expo push token. A token moves with the phone to whoever signs in on it. */
export const registerPushToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const userId = await requireUserId(ctx);
    await rateLimit(ctx, `pushToken:${userId}`, 20, 60 * 60_000);
    if (token.length > 200 || !/^Expo(nent)?PushToken\[[^\]]+\]$/.test(token)) {
      fail('That is not an Expo push token.');
    }
    const existing = await ctx.db
      .query('pushTokens')
      .withIndex('by_token', (q) => q.eq('token', token))
      .unique();
    if (existing) await ctx.db.patch(existing._id, { userId, updatedAt: Date.now() });
    else await ctx.db.insert('pushTokens', { userId, token, updatedAt: Date.now() });
  },
});
