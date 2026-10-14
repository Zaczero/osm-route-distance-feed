import { afterEach, beforeAll, expect, test } from "bun:test";
import {
  Miniflare,
  Request as WorkerRequest,
  Response as WorkerResponse,
  type MiniflareOptions,
} from "miniflare";
import { XMLParser } from "fast-xml-parser";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let script: string;
const runtimes: Miniflare[] = [];
const directories: string[] = [];
const route = "/rss/routed-car/route/v1/driving/13,52;14,53";
const parser = new XMLParser();

beforeAll(async () => {
  const result = await Bun.build({
    entrypoints: [new URL("./index.ts", import.meta.url).pathname],
    target: "browser",
    external: ["cloudflare:workers"],
  });
  if (!result.success)
    throw new AggregateError(result.logs, "Worker build failed");
  script = await result.outputs[0].text();
});

afterEach(async () => {
  try {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
  } finally {
    await Promise.all(
      directories
        .splice(0)
        .map((path) => rm(path, { recursive: true, force: true })),
    );
  }
});

function runtime(
  handler: (request: WorkerRequest) => WorkerResponse | Promise<WorkerResponse>,
  resourcePersistencePath?: string,
  requestLimit = 1000,
) {
  const options: MiniflareOptions = {
    resourcePersistencePath,
    cf: false,
    telemetry: { enabled: false },
    handleUncaughtError: () => {},
    workers: [
      {
        config: {
          name: "feed",
          domains: ["example.org"],
          compatibilityDate: "2026-10-13",
          manifest: {
            mainModule: "index.js",
            modules: { "index.js": { type: "esm", contents: script } },
          },
          exports: { RouteFeed: { type: "durable-object", storage: "sqlite" } },
          env: {
            REQUESTS: {
              type: "rate-limit",
              namespace: "101",
              simple: { limit: requestLimit, period: 60 },
            },
            FEEDS: {
              type: "durable-object",
              worker: "feed",
              exportName: "RouteFeed",
            },
          },
        },
        dev: { outboundService: { type: "fetcher", handler } },
      },
    ],
  };
  const result = new Miniflare(options);
  runtimes.push(result);
  return result;
}

function response(distance: number) {
  return WorkerResponse.json({
    code: "Ok",
    routes: [{ distance }],
    waypoints: [{ location: [13, 52] }, { location: [14, 53] }],
  });
}

test("the native request limit returns an uncached retryable response", async () => {
  const mf = runtime(() => response(12345), undefined, 2);
  const base = await mf.ready;
  expect((await fetch(new URL("/missing", base))).status).toBe(404);
  expect((await fetch(new URL("/missing", base))).status).toBe(404);
  const limited = await fetch(new URL("/missing", base));
  expect(limited.status).toBe(429);
  expect(limited.headers.get("Cache-Control")).toBe("no-store");
  expect(limited.headers.get("Retry-After")).toBe("60");
});

test("concurrent requests publish once and reuse cached history", async () => {
  let calls = 0;
  const mf = runtime(() => {
    calls++;
    return response(123450);
  });
  const base = await mf.ready;
  const bodies = await Promise.all(
    Array.from({ length: 6 }, async () => {
      const reply = await fetch(new URL(route, base));
      expect(reply.status, await reply.clone().text()).toBe(200);
      return reply.text();
    }),
  );
  expect(new Set(bodies).size).toBe(1);
  expect(parser.parse(bodies[0]).rss.channel.item.distance).toBe(123450);
  expect(calls).toBe(1);
  const again = await fetch(new URL(route, base));
  expect(await again.text()).toBe(bodies[0]);
  expect(calls).toBe(1);
}, 20_000);

test("history survives a runtime restart without refreshing the route", async () => {
  const path = await mkdtemp(join(tmpdir(), "route-feed-"));
  directories.push(path);
  const first = runtime(() => response(76543), path);
  const initial = await fetch(new URL(route, await first.ready));
  const body = await initial.text();
  expect(initial.status).toBe(200);
  await first.dispose();
  runtimes.splice(runtimes.indexOf(first), 1);
  let calls = 0;
  const restarted = runtime(() => {
    calls++;
    return response(99999);
  }, path);
  const restored = await fetch(new URL(route, await restarted.ready));
  expect(await restored.text()).toBe(body);
  expect(calls).toBe(0);
}, 20_000);

test("upstream failure does not publish partial state and a later request can recover", async () => {
  let calls = 0;
  const mf = runtime(() =>
    ++calls === 1
      ? new WorkerResponse("Unavailable", { status: 503 })
      : response(65432),
  );
  const base = await mf.ready;
  const failed = await fetch(new URL(route, base));
  expect(failed.status).toBe(500);
  await failed.text();
  const recovered = await fetch(new URL(route, base));
  expect(recovered.status).toBe(200);
  expect(parser.parse(await recovered.text()).rss.channel.item.distance).toBe(
    65432,
  );
}, 20_000);

test("names that collided as filenames now have independent feeds", async () => {
  let calls = 0;
  const mf = runtime(() => response(++calls * 11111));
  const base = await mf.ready;
  const first = await fetch(new URL(`${route}?name=a%2Fb`, base));
  const second = await fetch(new URL(`${route}?name=a%3Fb`, base));
  expect(parser.parse(await first.text()).rss.channel.item.distance).toBe(
    11111,
  );
  expect(parser.parse(await second.text()).rss.channel.item.distance).toBe(
    22222,
  );
}, 20_000);
