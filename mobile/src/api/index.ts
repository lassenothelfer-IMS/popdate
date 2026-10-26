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

export const convexServer =
  process.env.EXPO_PUBLIC_API === 'convex' && convexUrl ? new ConvexServer(convexUrl) : null;

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
