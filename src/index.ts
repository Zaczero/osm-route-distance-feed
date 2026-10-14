import { DurableObject } from "cloudflare:workers";
import {
  parseRequest,
  refreshInterval,
  renderFeed,
  updateFeed,
  type Feed,
  type FeedRequest,
} from "./feed";

interface Env {
  FEEDS: DurableObjectNamespace<RouteFeed>;
  REQUESTS: RateLimit;
}

interface RouteResponse {
  code: string;
  routes: { distance: number }[];
  waypoints: { location: [number, number] }[];
}

export class RouteFeed extends DurableObject<Env> {
  // All feeds share the routing provider's one-request-per-second budget.
  private pending: Promise<unknown> = Promise.resolve();

  async read(request: FeedRequest): Promise<Feed> {
    let feed = await this.ctx.storage.get<Feed>(JSON.stringify(request));
    if (!feed || Date.now() - feed.checkedAt >= refreshInterval) {
      const refresh = this.pending.then(() => this.refresh(request));
      this.pending = refresh.catch(() => {});
      feed = await refresh;
    }
    return feed;
  }

  private async refresh(request: FeedRequest): Promise<Feed> {
    const key = JSON.stringify(request);
    const previous = await this.ctx.storage.get<Feed>(key);
    if (previous && Date.now() - previous.checkedAt < refreshInterval)
      return previous;

    const lastRequest =
      (await this.ctx.storage.get<number>("lastRequest")) ?? 0;
    const delay = 1000 - (Date.now() - lastRequest);
    if (delay > 0) await scheduler.wait(delay);
    await this.ctx.storage.put("lastRequest", Date.now());
    const url = new URL("https://routing.openstreetmap.de");
    url.pathname = `/${request.route}`;
    url.searchParams.set("overview", "false");
    url.searchParams.set("steps", "false");
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
      headers: {
        "User-Agent":
          "osm-route-distance-feed (+https://github.com/Zaczero/osm-route-distance-feed)",
      },
    });
    if (!response.ok)
      throw new Error(`Routing service returned HTTP ${response.status}`);
    const result = await response.json<RouteResponse>();
    const distance = result.routes?.[0]?.distance;
    const start = result.waypoints?.[0]?.location;
    const end = result.waypoints?.at(-1)?.location;
    if (
      result.code !== "Ok" ||
      !Number.isFinite(distance) ||
      distance < 0 ||
      !start ||
      !end ||
      ![...start, ...end].every(Number.isFinite)
    ) {
      throw new Error("Routing service returned an invalid route");
    }
    const link = new URL("https://routing.openstreetmap.de/");
    link.searchParams.append("loc", `${start[1]},${start[0]}`);
    link.searchParams.append("loc", `${end[1]},${end[0]}`);
    link.searchParams.set(
      "srv",
      request.route.startsWith("routed-bike/")
        ? "1"
        : request.route.startsWith("routed-foot/")
          ? "2"
          : "0",
    );
    const feed = updateFeed(previous, request, distance, link.href, Date.now());
    await this.ctx.storage.put(key, feed);
    return feed;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const key = request.headers.get("CF-Connecting-IP") ?? "unknown";
    if (!(await env.REQUESTS.limit({ key })).success)
      return new Response("Too many requests", {
        status: 429,
        headers: { "Retry-After": "60", "Cache-Control": "no-store" },
      });
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/rss/"))
      return new Response("Not found", { status: 404 });
    if (request.method !== "GET")
      return new Response("Method not allowed", {
        status: 405,
        headers: { Allow: "GET" },
      });
    const query = parseRequest(url);
    if (!query)
      return new Response("Invalid route or threshold", { status: 422 });
    using feed = await env.FEEDS.getByName("feeds").read(query);
    const now = Date.now();
    const maxAge = Math.max(
      0,
      Math.floor((feed.checkedAt + refreshInterval - now) / 1000),
    );
    const body = renderFeed(feed, query);
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(body),
    );
    const etag = `W/"${btoa(String.fromCharCode(...new Uint8Array(digest)))}"`;
    return new Response(body, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": `public, max-age=${maxAge}, must-revalidate`,
        Date: new Date(now).toUTCString(),
        ETag: etag,
        "Last-Modified": feed.items[0].pubDate,
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
};
