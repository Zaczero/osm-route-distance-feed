# osm-route-distance-feed

![Python version](https://shields.monicz.dev/badge/python-v3.12-blue)
[![Project license](https://shields.monicz.dev/github/license/Zaczero/osm-route-distance-feed)](https://github.com/Zaczero/osm-route-distance-feed/blob/main/LICENSE)
[![Support my work](https://shields.monicz.dev/badge/%E2%99%A5%EF%B8%8F%20Support%20my%20work-purple)](https://monicz.dev/#support-my-work)
[![GitHub repo stars](https://shields.monicz.dev/github/stars/Zaczero/osm-route-distance-feed?style=social)](https://github.com/Zaczero/osm-route-distance-feed)

🗺️ Script that checks for distance changes on a given OpenStreetMap route and provides updates via RSS feed.

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

## Footer

### Contact me

https://monicz.dev/#get-in-touch

### Support my work

https://monicz.dev/#support-my-work

### License

This project is licensed under the GNU Affero General Public License v3.0.

The complete license text can be accessed in the repository at [LICENSE](https://github.com/Zaczero/osm-route-distance-feed/blob/main/LICENSE).
