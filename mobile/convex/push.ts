import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { internalAction, internalQuery, type MutationCtx } from './_generated/server';

/** Which notification setting a push falls under; people can turn each one off. */
const kind = v.union(v.literal('roomLive'), v.literal('newMatch'), v.literal('messages'));
type Kind = 'roomLive' | 'newMatch' | 'messages';

/** Where a tap on the push goes: the app reads this in `src/utils/push-routing.ts`. */
const data = v.union(
  v.object({ type: v.literal('room'), roomId: v.string() }),
  v.object({ type: v.literal('match'), matchId: v.string() }),
  v.object({ type: v.literal('chat'), matchId: v.string() }),
  v.object({ type: v.literal('matches') }),
);

/** The push tokens of the people who allow this kind of push. */
export const tokensFor = internalQuery({
  args: { userIds: v.array(v.id('users')), kind },
  handler: async (ctx, { userIds, kind }) => {
    const tokens: string[] = [];
    for (const userId of userIds) {
      const settings = await ctx.db
        .query('settings')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .unique();
      if (settings && !settings.notifications[kind]) continue;
      const rows = await ctx.db
        .query('pushTokens')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .collect();
      tokens.push(...rows.map((row) => row.token));
    }
    return tokens;
  },
});

/** Sends one push to each token through Expo's push service. Failures are dropped: pushes are a nudge. */
export const send = internalAction({
  args: { userIds: v.array(v.id('users')), kind, title: v.string(), body: v.string(), data },
  handler: async (ctx, { userIds, kind, title, body, data }) => {
    const tokens: string[] = await ctx.runQuery(internal.push.tokensFor, { userIds, kind });
    if (tokens.length === 0) return;
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(tokens.map((to) => ({ to, title, body, data, sound: 'default' }))),
    }).catch(() => undefined);
  },
});

type Push = {
  kind: Kind;
  title: string;
  body: string;
  data:
    | { type: 'room'; roomId: string }
    | { type: 'match'; matchId: string }
    | { type: 'chat'; matchId: string }
    | { type: 'matches' };
};

/** Queues a push from inside a mutation; it goes out once the mutation commits. */
export async function schedulePush(ctx: MutationCtx, userIds: Id<'users'>[], push: Push) {
  await ctx.scheduler.runAfter(0, internal.push.send, { userIds, ...push });
}
