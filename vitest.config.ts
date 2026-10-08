import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          // jsdom + web-base's shared setup (fake-indexeddb, jest-dom matchers,
          // Testing Library cleanup, a matchMedia stub). The setup touches
          // `window`, so the unit project can't run in the node environment.
          environment: "jsdom",
          setupFiles: ["./src/test/setup.ts"],
        },
      },
      {
        plugins: [
          cloudflareTest({
            main: "./worker/index.ts",
            miniflare: {
              compatibilityDate: "2026-04-01",
              r2Buckets: ["SYNC_BUCKET"],
              kvNamespaces: ["PAIR_KV"],
            },
          }),
        ],
        test: {
          name: "worker",
          include: ["worker/**/*.test.ts"],
        },
      },
    ],
  },
});
