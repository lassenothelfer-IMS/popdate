import { defineConfig } from 'vitest/config';

// Tests for the Convex backend in `convex/`, run in the same edge runtime Convex uses.
export default defineConfig({
  test: {
    environment: 'edge-runtime',
    include: ['convex/**/*.test.ts'],
    server: { deps: { inline: ['convex-test'] } },
  },
});
