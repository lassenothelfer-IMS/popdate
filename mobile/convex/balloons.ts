import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { internalMutation, query, type MutationCtx } from './_generated/server';
import {
  addBalloons,
  BALLOON_PACKS,
  balloonsView,
  PLUS_ENTITLEMENT,
  forgetIfDeleted,
  setPlusFromRevenueCat,
  setPlusUntil,
  transferPlus,
  updateKeptPlus,
} from './lib/balloons';

/**
 * Scheduled for when a deleted account's kept Popdate+ ends: the row goes then,
 * unless a later event moved the end, in which case it waits for that one.
 */
export const forgetDeletedWallet = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    if (await ctx.db.get(userId)) return;
    const row = await ctx.db
      .query('balloons')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (!row) return;
    if ((row.plusUntil ?? 0) > Date.now()) return;
    await forgetIfDeleted(ctx, userId);
  },
});

/** Your balloons, live: the `Balloons` shape in `src/api/types.ts`, or null when signed out. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId || !(await ctx.db.get(userId))) return null;
    return await balloonsView(ctx, userId);
  },
});

/**
 * RevenueCat events that set how long Popdate+ runs, from the event's expiration.
 * Not PRODUCT_CHANGE: its expiration belongs to the plan being left, and the new
 * plan's own RENEWAL follows.
 */
const PLUS_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'CANCELLATION',
  'EXPIRATION',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
]);

/** The Popdate account an event is about. The app logs RevenueCat in with the `users` id. */
async function accountOf(ctx: MutationCtx, ids: string[]): Promise<Id<'users'> | null> {
  for (const id of ids) {
    const userId = ctx.db.normalizeId('users', id);
    if (userId && (await ctx.db.get(userId))) return userId;
  }
  return null;
}

/** A Popdate id among RevenueCat's ids, even of an account deleted since. */
function popdateIdOf(ctx: MutationCtx, ids: string[]): Id<'users'> | null {
  for (const id of ids) {
    const userId = ctx.db.normalizeId('users', id);
    if (userId) return userId;
  }
  return null;
}

/**
 * Applies one RevenueCat webhook event (`http.ts` checks it came from RevenueCat).
 * A balloon pack adds its balloons; a Popdate+ event moves the end of Popdate+.
 * Each event counts once, however often RevenueCat resends it.
 */
export const applyPurchaseEvent = internalMutation({
  args: {
    eventId: v.string(),
    type: v.string(),
    userIds: v.array(v.string()),
    productId: v.optional(v.string()),
    entitlementIds: v.array(v.string()),
    expirationAtMs: v.optional(v.number()),
    /** When the event happened (RevenueCat's event_timestamp_ms). */
    eventAt: v.optional(v.number()),
    environment: v.optional(v.string()),
    store: v.optional(v.string()),
    /** TRANSFER only: the accounts the purchases moved from and to. */
    transferredFrom: v.optional(v.array(v.string())),
    transferredTo: v.optional(v.array(v.string())),
    /**
     * TRANSFER only, when `http.ts` could ask RevenueCat: when Popdate+ now ends for
     * each side (0 for none). Without them, the stored end date is moved instead.
     */
    plusUntilFrom: v.optional(v.number()),
    plusUntilTo: v.optional(v.number()),
  },
  handler: async (ctx, event) => {
    const seen = await ctx.db
      .query('purchaseEvents')
      .withIndex('by_event', (q) => q.eq('eventId', event.eventId))
      .unique();
    if (seen) return 'duplicate';

    // Test Store purchases are free: they count only on a deployment that opts in (dev).
    const ignored = event.store === 'TEST_STORE' && process.env.ACCEPT_TEST_STORE !== 'true';
    const eventAt = event.eventAt ?? Date.now();

    if (event.type === 'TRANSFER') {
      const from = popdateIdOf(ctx, event.transferredFrom ?? []);
      const to = await accountOf(ctx, event.transferredTo ?? []);
      let moved = false;
      if (!ignored && to && from !== to) {
        if (event.plusUntilTo !== undefined) {
          await setPlusUntil(ctx, to, event.plusUntilTo, eventAt);
          if (from) await setPlusFromRevenueCat(ctx, from, event.plusUntilFrom ?? 0, eventAt);
          moved = true;
        } else if (from) {
          moved = await transferPlus(ctx, from, to, eventAt);
        }
      }
      await ctx.db.insert('purchaseEvents', {
        eventId: event.eventId,
        userId: to ?? undefined,
        type: event.type,
        environment: event.environment,
        store: event.store,
        ignored: ignored || undefined,
        // Nothing could be moved: keep the ids, so it can be fixed by hand.
        revenueCatIds: moved ? undefined : [...(event.transferredFrom ?? []), ...(event.transferredTo ?? [])],
        receivedAt: Date.now(),
      });
      return to ? 'applied' : 'unknown user';
    }

    const userId = await accountOf(ctx, event.userIds);
    const plusEvent =
      PLUS_EVENTS.has(event.type) &&
      event.entitlementIds.includes(PLUS_ENTITLEMENT) &&
      event.expirationAtMs !== undefined;
    // A deleted account's kept Popdate+ end date follows its renewals and expiry.
    let keptUpdated = false;
    if (!userId && !ignored && plusEvent) {
      const deletedId = popdateIdOf(ctx, event.userIds);
      if (deletedId) keptUpdated = await updateKeptPlus(ctx, deletedId, event.expirationAtMs!, eventAt);
    }
    if (userId && !ignored) {
      const pack = event.productId ? BALLOON_PACKS[event.productId] : undefined;
      if (event.type === 'NON_RENEWING_PURCHASE' && pack) await addBalloons(ctx, userId, pack);
      if (
        PLUS_EVENTS.has(event.type) &&
        event.entitlementIds.includes(PLUS_ENTITLEMENT) &&
        event.expirationAtMs !== undefined
      ) {
        await setPlusUntil(ctx, userId, event.expirationAtMs, eventAt);
      }
    }

    await ctx.db.insert('purchaseEvents', {
      eventId: event.eventId,
      userId: userId ?? undefined,
      type: event.type,
      productId: event.productId,
      environment: event.environment,
      store: event.store,
      ignored: ignored || undefined,
      // No account found (the app only sells once RevenueCat is on one, so this should be rare):
      // keep what's needed to credit it by hand. Check `environment` first: SANDBOX is a test.
      revenueCatIds: userId || keptUpdated ? undefined : event.userIds,
      receivedAt: Date.now(),
    });
    return userId || keptUpdated ? 'applied' : 'unknown user';
  },
});
