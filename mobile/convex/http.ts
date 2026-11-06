import { httpRouter } from 'convex/server';

import { internal } from './_generated/api';
import { httpAction } from './_generated/server';
import { auth } from './auth';

const http = httpRouter();

auth.addHttpRoutes(http);

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
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
    await ctx.runMutation(internal.balloons.applyPurchaseEvent, {
      eventId: event.id,
      type: event.type,
      userIds,
      productId: typeof event.product_id === 'string' ? event.product_id : undefined,
      entitlementIds: strings(event.entitlement_ids),
      expirationAtMs: typeof event.expiration_at_ms === 'number' ? event.expiration_at_ms : undefined,
      eventAt: typeof event.event_timestamp_ms === 'number' ? event.event_timestamp_ms : undefined,
      environment: typeof event.environment === 'string' ? event.environment : undefined,
      transferredFrom: strings(event.transferred_from),
      transferredTo: strings(event.transferred_to),
    });
    // Unknown users and other event types are fine: RevenueCat only needs a 200 to stop resending.
    return new Response(null, { status: 200 });
  }),
});

export default http;
