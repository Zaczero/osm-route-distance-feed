import { XMLBuilder } from "fast-xml-parser";

export const refreshInterval = 2 * 60 * 60 * 1000;

export interface FeedRequest {
  route: string;
  threshold: number;
  name: string;
}

export interface FeedItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  distance: number;
}

export interface Feed {
  checkedAt: number;
  link: string;
  items: FeedItem[];
}

export function parseRequest(url: URL): FeedRequest | null {
  let route: string;
  try {
    route = decodeURIComponent(url.pathname.slice("/rss/".length)).replace(
      /\/+$/,
      "",
    );
  } catch {
    return null;
  }
  const threshold = Number(url.searchParams.get("threshold") ?? 50);
  if (
    !/^routed-[^/]+\/route\/v1\/[^/]+\/[^/]+$/.test(route) ||
    !Number.isSafeInteger(threshold) ||
    threshold < 0
  )
    return null;
  return { route, threshold, name: url.searchParams.get("name") ?? "" };
}

export function updateFeed(
  previous: Feed | undefined,
  request: FeedRequest,
  distance: number,
  link: string,
  now: number,
): Feed {
  const items = previous?.items ?? [];
  const last = items[0]?.distance;
  const delta = last === undefined ? undefined : distance - last;
  const next = { checkedAt: now, link, items };
  if (
    delta !== undefined &&
    (delta === 0 || Math.abs(delta) < request.threshold)
  )
    return next;

  const route = request.name ? `The route "${request.name}"` : "The route";
  const kilometres = (distance / 1000).toFixed(2);
  const sign = delta !== undefined && delta >= 0 ? "+" : "";
  const title =
    last === undefined
      ? `Route distance: ${kilometres} km`
      : last === 0
        ? `Distance changed by ${sign}${(delta! / 1000).toFixed(2)} km`
        : `Distance changed by ${sign}${((delta! / last) * 100).toFixed(3)}%`;
  return {
    ...next,
    items: [
      {
        title,
        description:
          last === undefined
            ? `${route} distance is ${kilometres} km.`
            : `${route} distance was changed from ${(last / 1000).toFixed(2)} km. to ${kilometres} km.`,
        link,
        pubDate: new Date(now).toUTCString(),
        distance,
      },
      ...items,
    ].slice(0, 30),
  };
}

const xml = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  format: true,
});

export function renderFeed(feed: Feed, request: FeedRequest): string {
  return (
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    xml.build({
      rss: {
        "@version": "2.0",
        channel: {
          title: "osm-route-distance-feed",
          description:
            "This RSS feed notifies of distance changes on a given OpenStreetMap route.",
          link: feed.link,
          threshold: request.threshold,
          name: request.name,
          pubDate: new Date(feed.checkedAt).toUTCString(),
          ttl: refreshInterval / 60_000,
          item: feed.items,
        },
      },
    })
  );
}
