import path from 'node:path';

import { defineConfig } from 'vitest/config';

// The Convex backend in `convex/` and the app's plain logic in `src/`, run in the
// same edge runtime Convex uses. Nothing here renders React Native.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'edge-runtime',
    include: ['convex/**/*.test.ts', 'src/**/*.test.ts'],
    server: { deps: { inline: ['convex-test'] } },
  },
});
