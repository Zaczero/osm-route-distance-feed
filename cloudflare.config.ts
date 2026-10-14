import { bindings, defineConfig, exports as workerExports } from "cf/config";
import { loadEnv } from "vite";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig(({ mode }) => {
  const { WORKER_DOMAIN } = loadEnv(
    mode ?? "production",
    process.cwd(),
    "WORKER_DOMAIN",
  );
  return {
    worker: {
      name: "osm-route-distance-feed",
      compatibilityDate: "2026-10-13",
      entrypoint,
      cache: { enabled: true },
      domains: WORKER_DOMAIN ? [WORKER_DOMAIN] : undefined,
      exports: {
        RouteFeed: workerExports.durableObject({ storage: "sqlite" }),
      },
      env: {
        REQUESTS: bindings.rateLimit({
          namespace: "101",
          simple: { limit: 1000, period: 60 },
        }),
        FEEDS: bindings.durableObject({
          worker: "osm-route-distance-feed",
          exportName: "RouteFeed",
        }),
      },
    },
  };
});
