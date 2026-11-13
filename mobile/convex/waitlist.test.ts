import { convexTest } from 'convex-test';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { internal } from './_generated/api';
import schema from './schema';
import { modules } from './test.setup';

const ORIGIN = 'https://popdate.test';

beforeEach(() => {
  process.env.WAITLIST_ORIGINS = ORIGIN;
});

afterEach(() => {
  delete process.env.WAITLIST_ORIGINS;
  vi.restoreAllMocks();
});

const signup = {
  email: '  Mia@Example.com ',
  phone: 'iphone',
  language: 'de',
  source: 'TikTok',
  elapsedMs: 9_000,
  website: '',
};

function post(t: ReturnType<typeof convexTest>, path: string, body: unknown, origin = ORIGIN) {
  return t.fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
  });
}

async function rows(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => await ctx.db.query('waitlist').collect());
}

test('a signup is cleaned and saved as pending', async () => {
  const t = convexTest(schema, modules);
  const response = await post(t, '/waitlist/join', signup);
  expect(response.status).toBe(200);
  expect(response.headers.get('access-control-allow-origin')).toBe(ORIGIN);

  const [row] = await rows(t);
  expect(row).toMatchObject({
    email: 'mia@example.com',
    phone: 'iphone',
    language: 'de',
    status: 'pending',
    source: 'tiktok',
  });
  expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
});

test('another site cannot post', async () => {
  const t = convexTest(schema, modules);
  const response = await post(t, '/waitlist/join', signup, 'https://evil.test');
  expect(response.status).toBe(403);
  expect(await rows(t)).toHaveLength(0);
});

test('bots and bad data are not saved', async () => {
  const t = convexTest(schema, modules);
  expect((await post(t, '/waitlist/join', { ...signup, website: 'spam.biz' })).status).toBe(200);
  expect((await post(t, '/waitlist/join', { ...signup, elapsedMs: 300 })).status).toBe(200);
  expect((await post(t, '/waitlist/join', { ...signup, email: 'not-an-email' })).status).toBe(400);
  expect((await post(t, '/waitlist/join', { ...signup, phone: 'windows' })).status).toBe(400);
  expect(await rows(t)).toHaveLength(0);
});

test('signing up twice keeps one row and answers the same', async () => {
  const t = convexTest(schema, modules);
  await post(t, '/waitlist/join', signup);
  const again = await post(t, '/waitlist/join', { ...signup, phone: 'android' });
  expect(again.status).toBe(200);
  expect(await rows(t)).toHaveLength(1);
});

test('the confirm and leave links work with the emailed token', async () => {
  const t = convexTest(schema, modules);
  const token = 'a'.repeat(43);
  const tokenHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  await t.mutation(internal.waitlist.join, {
    email: 'leo@example.com', phone: 'android', tokenHash,
  });

  expect((await post(t, '/waitlist/confirm', { token: 'b'.repeat(43) })).status).toBe(404);
  expect((await post(t, '/waitlist/confirm', { token })).status).toBe(200);
  expect((await rows(t))[0].status).toBe('confirmed');

  expect((await post(t, '/waitlist/leave', { token })).status).toBe(200);
  expect(await rows(t)).toHaveLength(0);
});

test('the export defuses spreadsheet formulas', async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.waitlist.join, {
    email: '=HYPERLINK("evil")@example.com', phone: 'iphone', tokenHash: 'h',
  });
  const csv = await t.query(internal.waitlist.exportCsv, {});
  expect(csv).toContain(`"'=HYPERLINK(""evil"")@example.com"`);
});
