# osm-route-distance-feed

Follow changes to an OpenStreetMap route's distance in your RSS reader.
Useful for noticing when map edits or routing updates change a familiar journey.

```text
GET /rss/routed-car/route/v1/driving/15.00878,51.18073;23.11149,49.95571?threshold=100&name=My%20route
```

`threshold` is the minimum absolute change in metres, defaulting to 50. `name` is
an optional label. Changes accumulate against the last published distance, so
several smaller changes can eventually produce an entry. The first entry records
the initial distance. Each feed retains its latest 30 entries.

Feeds refresh when a reader requests them, at most once every two hours.
Failed refreshes leave the existing history intact so readers can retry.
Readers can use `ETag` or `Last-Modified` to check for updates without downloading
an unchanged feed again; unchanged responses return HTTP 304.

Routing is provided by [FOSSGIS's OSRM service](https://routing.openstreetmap.de/),
using data from [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
Found an issue with a route? [Help fix the map](https://www.openstreetmap.org/fixthemap).

## License

GNU Affero General Public License v3.0; see [LICENSE](LICENSE).

[Contact](https://monicz.dev/#get-in-touch) ·
[Support this project](https://monicz.dev/#support-my-work)
