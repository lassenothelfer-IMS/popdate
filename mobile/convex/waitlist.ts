import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import { httpAction, internalMutation, internalQuery } from './_generated/server';
import { rateLimit } from './lib/rateLimit';
import { waitlistLanguage, waitlistPhone } from './schema';

/**
 * The launch waitlist. The page in `waitlist/` posts to the HTTP routes at the
 * bottom (registered in `http.ts`); everything that touches the table is internal,
 * so no client can read the list. Read it in the Convex dashboard, or with
 * `npm run waitlist:stats` and `npm run waitlist:export` (see `waitlist/README.md`).
 *
 * Env vars (`npx convex env set NAME value`):
 * - WAITLIST_ORIGINS: comma-separated origins allowed to post, e.g. https://popdate.app
 * - WAITLIST_SITE_URL: where confirm and leave links point, e.g. https://popdate.app
 * - RESEND_API_KEY, WAITLIST_FROM: sends the confirmation email through Resend.
 *   Without them people are still saved, as "pending", and nothing is sent.
 */

/** Bump when the consent sentence on the page changes. */
export const CONSENT_VERSION = '2026-11-11';

/** A pending signup gets at most one confirmation email per this long. */
const RESEND_AFTER_MS = 10 * 60_000;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SOURCE = /^[a-z0-9_-]{1,32}$/;

const signupFields = {
  email: v.string(),
  phone: waitlistPhone,
  language: v.optional(waitlistLanguage),
  source: v.optional(v.string()),
};

type Signup = {
  email: string;
  phone: Doc<'waitlist'>['phone'];
  language?: Doc<'waitlist'>['language'];
  source?: string;
};

/** Cleans a signup the way the table stores it, or returns null if any field is off. */
export function cleanSignup(raw: unknown): Signup | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === 'string' ? value : '');

  const email = text(r.email).trim().toLowerCase();
  const source = text(r.source).trim().toLowerCase();

  if (email.length > 254 || !EMAIL.test(email)) return null;
  if (r.phone !== 'iphone' && r.phone !== 'android') return null;
  const language = ['en', 'de', 'fr', 'it'].includes(text(r.language)) ? (r.language as Signup['language']) : undefined;

  return {
    email,
    phone: r.phone,
    language,
    source: SOURCE.test(source) ? source : undefined,
  };
}

/**
 * Saves a signup, or refreshes a pending one. Returns whether to email a confirm
 * link with the token behind `tokenHash`. The page shows the same message either
 * way, so nobody can find out who is on the list.
 */
export const join = internalMutation({
  args: { ...signupFields, tokenHash: v.string(), clientKey: v.optional(v.string()) },
  handler: async (ctx, { tokenHash, clientKey, ...signup }) => {
    // A script could fill the table, so: 5 tries per visitor per 10 minutes, 120 a minute overall.
    if (clientKey) await rateLimit(ctx, `waitlist:${clientKey}`, 5, 10 * 60_000);
    await rateLimit(ctx, 'waitlist:all', 120, 60_000);

    const now = Date.now();
    const existing = await ctx.db
      .query('waitlist')
      .withIndex('by_email', (q) => q.eq('email', signup.email))
      .unique();

    if (!existing) {
      await ctx.db.insert('waitlist', {
        ...signup,
        status: 'pending',
        tokenHash,
        consentVersion: CONSENT_VERSION,
        createdAt: now,
        lastEmailAt: now,
      });
      return { sendEmail: true };
    }
    // Someone else typing a confirmed address changes nothing about it.
    if (existing.status === 'confirmed') return { sendEmail: false };
    if (existing.lastEmailAt !== undefined && now - existing.lastEmailAt < RESEND_AFTER_MS) {
      return { sendEmail: false };
    }
    await ctx.db.patch(existing._id, { ...signup, tokenHash, consentVersion: CONSENT_VERSION, lastEmailAt: now });
    return { sendEmail: true };
  },
});

export const confirm = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const row = await ctx.db
      .query('waitlist')
      .withIndex('by_token', (q) => q.eq('tokenHash', tokenHash))
      .unique();
    if (!row) return false;
    if (row.status !== 'confirmed') await ctx.db.patch(row._id, { status: 'confirmed', confirmedAt: Date.now() });
    return true;
  },
});

/** Deletes the row for good: the "remove me" link in every email. */
export const leave = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const row = await ctx.db
      .query('waitlist')
      .withIndex('by_token', (q) => q.eq('tokenHash', tokenHash))
      .unique();
    if (row) await ctx.db.delete(row._id);
    return true;
  },
});

/** Unconfirmed signups are deleted after 30 days, as the privacy policy says. Runs daily from `crons.ts`. */
export const pruneUnconfirmed = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60_000;
    const stale = await ctx.db
      .query('waitlist')
      .filter((q) => q.and(q.eq(q.field('status'), 'pending'), q.lt(q.field('createdAt'), cutoff)))
      .take(500);
    for (const row of stale) await ctx.db.delete(row._id);
    return stale.length;
  },
});

/** Counts for the marketing plan: totals, phones and where people came from. */
export const stats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('waitlist').collect();
    const count = (key: (row: Doc<'waitlist'>) => string) =>
      Object.fromEntries(
        Object.entries(
          rows.reduce<Record<string, number>>((acc, row) => {
            acc[key(row)] = (acc[key(row)] ?? 0) + 1;
            return acc;
          }, {}),
        ).sort((a, b) => b[1] - a[1]),
      );
    return {
      total: rows.length,
      byStatus: count((row) => row.status),
      byPhone: count((row) => row.phone),
      bySource: count((row) => row.source ?? 'direct'),
    };
  },
});

/** The whole list as CSV, newest first. `npx convex run waitlist:exportCsv > waitlist.csv` */
export const exportCsv = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('waitlist').order('desc').collect();
    const header = ['email', 'status', 'phone', 'language', 'source', 'signed_up', 'confirmed'];
    const lines = rows.map((row) =>
      [
        row.email,
        row.status,
        row.phone,
        row.language ?? '',
        row.source ?? '',
        new Date(row.createdAt).toISOString(),
        row.confirmedAt ? new Date(row.confirmedAt).toISOString() : '',
      ].map(csvCell).join(','),
    );
    return [header.join(','), ...lines].join('\n');
  },
});

/** Quotes a cell, and defuses formulas so a city like "=HYPERLINK(...)" stays text in Excel. */
function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

// ---------------------------------------------------------------------------
// HTTP routes for the page

const MAX_BODY = 4_000;

function allowedOrigin(request: Request) {
  const origin = request.headers.get('origin') ?? '';
  const allowed = (process.env.WAITLIST_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

function reply(origin: string | null, status: number, body?: unknown) {
  const headers: Record<string, string> = { 'Cache-Control': 'no-store', Vary: 'Origin' };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }
  if (body === undefined) return new Response(null, { status, headers });
  headers['Content-Type'] = 'application/json';
  return new Response(JSON.stringify(body), { status, headers });
}

export const preflight = httpAction(async (_ctx, request) => {
  const origin = allowedOrigin(request);
  return reply(origin, origin ? 204 : 403);
});

/** Reads a small JSON body from an allowed origin, or returns the response to send instead. */
async function readBody(request: Request): Promise<{ origin: string; body: Record<string, unknown> } | Response> {
  const origin = allowedOrigin(request);
  // Only the waitlist page may post: this is the CSRF check, since there are no cookies to protect.
  if (!origin) return reply(null, 403, { error: 'Not allowed.' });
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) {
    return reply(origin, 415, { error: 'Send JSON.' });
  }
  const text = await request.text();
  if (text.length > MAX_BODY) return reply(origin, 413, { error: 'Too much data.' });
  try {
    const body = JSON.parse(text);
    if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new Error('not an object');
    return { origin, body };
  } catch {
    return reply(origin, 400, { error: 'Something went wrong. Try again.' });
  }
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export const joinRoute = httpAction(async (ctx, request) => {
  const read = await readBody(request);
  if (read instanceof Response) return read;
  const { origin, body } = read;

  // Bots fill the hidden field or submit faster than a person can type: tell them it worked, save nothing.
  if (body.website || typeof body.elapsedMs !== 'number' || body.elapsedMs < 2_500) {
    return reply(origin, 200, { ok: true });
  }
  const signup = cleanSignup(body);
  if (!signup) return reply(origin, 400, { error: 'Check your details and try again.' });

  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const clientKey = forwarded ? (await sha256(`waitlist:${forwarded}`)).slice(0, 32) : undefined;
  const token = newToken();
  let sendEmail: boolean;
  try {
    ({ sendEmail } = await ctx.runMutation(internal.waitlist.join, { ...signup, tokenHash: await sha256(token), clientKey }));
  } catch {
    return reply(origin, 429, { error: 'Slow down a little and try again in a moment.' });
  }
  if (sendEmail) await sendConfirmEmail(signup.email, token);
  return reply(origin, 200, { ok: true });
});

export const confirmRoute = httpAction(async (ctx, request) => {
  const read = await readBody(request);
  if (read instanceof Response) return read;
  const token = read.body.token;
  if (typeof token !== 'string' || !TOKEN.test(token)) return reply(read.origin, 400, { error: 'This link is not valid.' });
  const found = await ctx.runMutation(internal.waitlist.confirm, { tokenHash: await sha256(token) });
  return found ? reply(read.origin, 200, { ok: true }) : reply(read.origin, 404, { error: 'This link has expired or was already used to leave.' });
});

export const leaveRoute = httpAction(async (ctx, request) => {
  const read = await readBody(request);
  if (read instanceof Response) return read;
  const token = read.body.token;
  if (typeof token !== 'string' || !TOKEN.test(token)) return reply(read.origin, 400, { error: 'This link is not valid.' });
  await ctx.runMutation(internal.waitlist.leave, { tokenHash: await sha256(token) });
  return reply(read.origin, 200, { ok: true });
});

/** Sends the confirm link through Resend. Without a key it only logs, and the signup stays pending. */
async function sendConfirmEmail(email: string, token: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.WAITLIST_FROM;
  const site = process.env.WAITLIST_SITE_URL;
  if (!key || !from || !site) {
    console.warn('Waitlist email not sent: set RESEND_API_KEY, WAITLIST_FROM and WAITLIST_SITE_URL.');
    return;
  }
  // The token rides in the fragment, so it never reaches a server log or a Referer header.
  const confirmUrl = `${site}/confirm#${token}`;
  const leaveUrl = `${site}/leave#${token}`;
  const text = [
    'Hi,',
    '',
    'Tap the link to confirm your spot on the Popdate waitlist. We will email you once when rooms open near you.',
    '',
    confirmUrl,
    '',
    "Didn't sign up? Ignore this email and nothing happens. To remove your details now:",
    leaveUrl,
    '',
    'Popdate. Be the last balloon.',
  ].join('\n');
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#1C1917;max-width:480px">
<p style="font-family:Georgia,serif;font-size:26px;margin:0 0 16px">Popdate</p>
<p>Tap the button to confirm your spot on the waitlist. We will email you once when rooms open near you.</p>
<p style="margin:28px 0"><a href="${confirmUrl}" style="background:#1C1917;color:#F6F2EB;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:600">Confirm my spot</a></p>
<p style="color:#5F574F;font-size:14px">Didn't sign up? Ignore this email and nothing happens. <a href="${leaveUrl}" style="color:#5F574F">Remove my details</a>.</p>
</div>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [email], subject: 'Confirm your spot on the Popdate waitlist', text, html }),
  });
  if (!response.ok) console.error(`Waitlist email failed: ${response.status}`);
}
