import { expect, test } from "bun:test";
import { XMLParser } from "fast-xml-parser";
import { parseRequest, renderFeed, updateFeed, type Feed } from "./feed";

const request = {
  route: "routed-car/route/v1/driving/13,52;14,53",
  threshold: 50,
  name: "",
};

test("starts with a distance instead of an artificial percentage", () => {
  const feed = updateFeed(
    undefined,
    request,
    123_450,
    "https://example.org/",
    0,
  );
  expect(feed.items[0].title).toBe("Route distance: 123.45 km");
  expect(feed.items[0].distance).toBe(123_450);
});

test("compares cumulative changes to the last published distance", () => {
  const first = updateFeed(undefined, request, 1000, "https://example.org/", 0);
  const below = updateFeed(first, request, 1030, first.link, 1000);
  expect(below.items).toHaveLength(1);
  const above = updateFeed(below, request, 1060, first.link, 2000);
  expect(above.items).toHaveLength(2);
  expect(above.items[0].title).toBe("Distance changed by +6.000%");
});

test("zero distance and zero threshold do not divide by zero or duplicate unchanged entries", () => {
  const zero = { ...request, threshold: 0 };
  const first = updateFeed(undefined, zero, 0, "https://example.org/", 0);
  expect(updateFeed(first, zero, 0, first.link, 1000).items).toHaveLength(1);
  expect(updateFeed(first, zero, 100, first.link, 2000).items[0].title).toBe(
    "Distance changed by +0.10 km",
  );
});

test("retains the newest 30 changes", () => {
  let feed: Feed | undefined;
  for (let i = 1; i <= 35; i++)
    feed = updateFeed(feed, request, i * 100, "https://example.org/", i * 1000);
  expect(feed!.items).toHaveLength(30);
  expect(feed!.items[0].distance).toBe(3500);
  expect(feed!.items.at(-1)!.distance).toBe(600);
});

test("renders escaped RSS with TTL in minutes", () => {
  const named = { ...request, name: '<roads & "bridges">' };
  const feed = updateFeed(
    undefined,
    named,
    1250,
    "https://example.org/?a=1&b=2",
    0,
  );
  const body = renderFeed(feed, named);
  const channel = new XMLParser().parse(body).rss.channel;
  expect(channel.ttl).toBe(120);
  expect(channel.name).toBe(named.name);
  expect(channel.item.description).toBe(
    'The route "<roads & "bridges">" distance is 1.25 km.',
  );
  expect(body).not.toContain("<roads");
});

test.each(["-1", "1.5", "NaN", "Infinity"])(
  "rejects invalid threshold %s",
  (threshold) => {
    expect(
      parseRequest(
        new URL(
          `https://example.org/rss/${request.route}?threshold=${threshold}`,
        ),
      ),
    ).toBeNull();
  },
);
