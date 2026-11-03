import { ConvexServer } from '@/api/convex-server';
import { mockServer, type MockRole } from '@/api/mock-server';
import type { PopdateApi } from '@/api/types';

/**
 * The server the app talks to. By default it's the in-memory mock with bot
 * players. Set `EXPO_PUBLIC_API=convex` (and `EXPO_PUBLIC_CONVEX_URL`, which
 * `npx convex dev` writes to `.env.local`) to play on the Convex backend in
 * `convex/`. The screens are the same either way.
 */
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
const wantsConvex = process.env.EXPO_PUBLIC_API === 'convex';

// Asked for Convex without saying where it is: never fall back to the bots quietly.
// A release build stops right here, so a misconfigured build can't ship on the mock.
if (wantsConvex && !convexUrl) {
  const message = 'EXPO_PUBLIC_API is convex but EXPO_PUBLIC_CONVEX_URL is not set';
  console.error(__DEV__ ? `${message}: using the mock server.` : message);
  if (!__DEV__) throw new Error(message);
}

export const convexServer = wantsConvex && convexUrl ? new ConvexServer(convexUrl) : null;

export const api: PopdateApi = convexServer ?? mockServer;

export const isMockServer = convexServer === null;

/** Mock only: which role you get in the next room. */
export function setMockNextRole(role: MockRole) {
  mockServer.nextRole = role;
}

export function getMockNextRole() {
  return mockServer.nextRole;
}

export type { MockRole };
export type * from '@/api/types';
