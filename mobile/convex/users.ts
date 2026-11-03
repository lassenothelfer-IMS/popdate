import { getAuthUserId } from '@convex-dev/auth/server';

import { mutation, query } from './_generated/server';

/** The server's clock, so phones can count down to a deadline. A mutation, so it's never cached. */
export const serverTime = mutation({
  args: {},
  handler: async () => Date.now(),
});

/** Your account id, or null when signed out or when the account was deleted. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId || !(await ctx.db.get(userId))) return null;
    return userId as string;
  },
});
