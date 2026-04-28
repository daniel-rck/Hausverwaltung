import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        plugins: [
          cloudflareTest({
            main: './worker/index.ts',
            wrangler: { configPath: './wrangler.toml' },
            miniflare: {
              compatibilityDate: '2026-04-01',
              r2Buckets: ['SYNC_BUCKET'],
              kvNamespaces: ['PAIR_KV'],
            },
          }),
        ],
        test: {
          name: 'worker',
          include: ['worker/**/*.test.ts'],
        },
      },
    ],
  },
});
