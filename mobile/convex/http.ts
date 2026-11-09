import { httpRouter } from 'convex/server';

import { internal } from './_generated/api';
import { httpAction } from './_generated/server';
import { auth } from './auth';
import { confirmRoute, joinRoute, leaveRoute, preflight } from './waitlist';

const http = httpRouter();

auth.addHttpRoutes(http);

// The launch waitlist page in `waitlist/`.
for (const [path, handler] of [
  ['/waitlist/join', joinRoute],
  ['/waitlist/confirm', confirmRoute],
  ['/waitlist/leave', leaveRoute],
] as const) {
  http.route({ path, method: 'POST', handler });
  http.route({ path, method: 'OPTIONS', handler: preflight });
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Popdate+ that never ends (RevenueCat's null expiry, a lifetime grant). */
const FOREVER = Date.UTC(2100, 0, 1);

/**
 * When Popdate+ ends for a RevenueCat customer, from RevenueCat itself: 0 for none.
 * Undefined when there's no secret key to ask with; throws when RevenueCat can't answer,
 * so the webhook fails and RevenueCat sends the event again later.
 */
async function plusUntilFromRevenueCat(appUserId: string | undefined): Promise<number | undefined> {
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key || !appUserId) return undefined;
  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  // A refused key won't work on a retry either: fall back to the stored dates instead.
  if (response.status === 401 || response.status === 403) {
    console.error(`RevenueCat refused REVENUECAT_SECRET_KEY (${response.status})`);
    return undefined;
  }
  if (!response.ok) throw new Error(`RevenueCat answered ${response.status}`);
  const body = (await response.json()) as {
    subscriber?: {
      entitlements?: Record<string, { expires_date?: string | null; product_identifier?: string }>;
      subscriptions?: Record<string, { store?: string }>;
    };
  };
  const plus = body.subscriber?.entitlements?.plus;
  if (!plus) return 0;
  // Popdate+ from the Test Store is free: only a deployment that accepts Test Store counts it.
  const store = body.subscriber?.subscriptions?.[plus.product_identifier ?? '']?.store;
  if (store?.toLowerCase() === 'test_store' && process.env.ACCEPT_TEST_STORE !== 'true') return undefined;
  if (plus.expires_date === null || plus.expires_date === undefined) return FOREVER;
  const until = Date.parse(plus.expires_date);
  return Number.isNaN(until) ? 0 : until;
}

/** The first id that isn't one of RevenueCat's anonymous ones. */
function namedId(ids: string[]) {
  return ids.find((id) => !id.startsWith('$RCAnonymousID'));
}

/**
 * RevenueCat's webhook: purchases, renewals and expirations land here.
 * In RevenueCat (Integrations → Webhooks) the URL is
 * `https://<deployment>.convex.site/revenuecat`, and the Authorization header is
 * the same value as the `REVENUECAT_WEBHOOK_AUTH` environment variable in Convex.
 */
http.route({
  path: '/revenuecat',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.REVENUECAT_WEBHOOK_AUTH;
    // No secret set means the webhook isn't set up: refuse rather than trust anyone.
    if (!secret) return new Response('Webhook not configured', { status: 503 });
    if (request.headers.get('Authorization') !== secret) return new Response('Unauthorized', { status: 401 });

    let event: Record<string, unknown>;
    try {
      const body = (await request.json()) as { event?: unknown };
      if (!body.event || typeof body.event !== 'object') throw new Error('No event');
      event = body.event as Record<string, unknown>;
    } catch {
      return new Response('Bad request', { status: 400 });
    }
    if (typeof event.id !== 'string' || typeof event.type !== 'string') {
      return new Response('Bad request', { status: 400 });
    }

    const userIds = [
      ...new Set([
        ...strings([event.app_user_id, event.original_app_user_id]),
        ...strings(event.aliases),
      ]),
    ];
    const transferredFrom = strings(event.transferred_from);
    const transferredTo = strings(event.transferred_to);
    let plusUntilFrom: number | undefined;
    let plusUntilTo: number | undefined;
    if (event.type === 'TRANSFER') {
      // What RevenueCat moved, from RevenueCat: the stored dates may be stale or missing.
      try {
        plusUntilTo = await plusUntilFromRevenueCat(namedId(transferredTo));
        if (plusUntilTo !== undefined) plusUntilFrom = await plusUntilFromRevenueCat(namedId(transferredFrom));
      } catch {
        return new Response('RevenueCat lookup failed', { status: 500 });
      }
    }

    await ctx.runMutation(internal.balloons.applyPurchaseEvent, {
      eventId: event.id,
      type: event.type,
      userIds,
      productId: typeof event.product_id === 'string' ? event.product_id : undefined,
      entitlementIds: strings(event.entitlement_ids),
      expirationAtMs: typeof event.expiration_at_ms === 'number' ? event.expiration_at_ms : undefined,
      eventAt: typeof event.event_timestamp_ms === 'number' ? event.event_timestamp_ms : undefined,
      environment: typeof event.environment === 'string' ? event.environment : undefined,
      store: typeof event.store === 'string' ? event.store : undefined,
      transferredFrom,
      transferredTo,
      plusUntilFrom,
      plusUntilTo,
    });
    // Unknown users and other event types are fine: RevenueCat only needs a 200 to stop resending.
    return new Response(null, { status: 200 });
  }),
});

export default http;
