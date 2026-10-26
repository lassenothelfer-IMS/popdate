import { mockServer, type MockRole } from '@/api/mock-server';
import type { PopdateApi } from '@/api/types';

/**
 * The server the app talks to. For now this is the in-memory mock with bot
 * players. Once Jonas's Supabase project is up, swap in an implementation of
 * `PopdateApi` that calls the server functions, and the screens stay as they are.
 */
export const api: PopdateApi = mockServer;

export const isMockServer = true;

/** Mock only: which role you get in the next room. */
export function setMockNextRole(role: MockRole) {
  mockServer.nextRole = role;
}

export function getMockNextRole() {
  return mockServer.nextRole;
}

export type { MockRole };
export type * from '@/api/types';
