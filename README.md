# osm-route-distance-feed
🗺️ Script that checks for distance changes on a given OpenStreetMap route and provides updates via RSS feed

## Example

http://localhost:8000/rss/routed-car/route/v1/driving/15.00878,51.18073;23.11149,49.95571?threshold=10

```xml
<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>osm-route-distance-feed</title>
    <description>This RSS feed checks for distance changes on a given route on OpenStreetMap and provides updates when changes are detected.</description>
    <link>https://routing.openstreetmap.de/routed-car/route/v1/driving/15.00878,51.18073;23.11149,49.95571</link>
    <item>
      <title>Distance changed by +66824700.000%</title>
      <description>Previously: 0.00 km., Currently: 668.25 km.</description>
      <link>https://routing.openstreetmap.de/routed-car/route/v1/driving/15.00878,51.18073;23.11149,49.95571</link>
      <pubDate>Fri, 09 Dec 2022 20:35:03 GMT</pubDate>
      <distance>668248</distance>
    </item>
    <threshold>10</threshold>
    <pubDate>Fri, 09 Dec 2022 20:35:03 GMT</pubDate>
    <ttl>7200</ttl>
  </channel>
</rss>
```
