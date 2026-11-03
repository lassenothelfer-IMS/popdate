import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Two test projects: the Convex backend in `convex/`, run in the same edge runtime
// Convex uses, and plain unit tests in `src/`, run in Node.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'backend',
          environment: 'edge-runtime',
          include: ['convex/**/*.test.ts'],
          server: { deps: { inline: ['convex-test'] } },
        },
      },
      {
        resolve: {
          alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
        },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
    ],
  },
});
