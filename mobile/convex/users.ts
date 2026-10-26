import { getAuthUserId } from '@convex-dev/auth/server';

import { query } from './_generated/server';

/** Your account id, or null when signed out or when the account was deleted. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId || !(await ctx.db.get(userId))) return null;
    return userId as string;
  },
});
