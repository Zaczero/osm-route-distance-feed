import os
from pathlib import Path
from time import time

import requests as requests
import xmltodict
from babel.dates import format_datetime
from fastapi import FastAPI, Query
from fastapi.responses import FileResponse

work_dir = Path(os.getenv('WORK_DIR', '.'))
cache_seconds = float(os.getenv('CACHE_HOURS', '2')) * 3600
rss_max_size = int(os.getenv('RSS_MAX_SIZE', '30'))
route_url = os.getenv('ROUTE_URL', 'https://routing.openstreetmap.de')

assert cache_seconds >= 0, 'Error: Cache duration must be non-negative'
assert work_dir.exists(), f'Error: {work_dir} does not exist'
assert work_dir.is_dir(), f'Error: {work_dir} is not a directory'

feeds_dir = work_dir / Path('feeds')
feeds_dir.mkdir(exist_ok=True)

app = FastAPI()


def escape_text(text: str) -> str:
    return ''.join((c if c.isalnum() else '-') for c in text)


def get_feed_path(request: str, threshold: int, name: str) -> Path:
    if name:
        return feeds_dir / Path(f'{escape_text(request)}.{escape_text(name)}.{threshold}.xml')
    else:
        return feeds_dir / Path(f'{escape_text(request)}.{threshold}.xml')


def update_cache(feed_path: Path, request: str, threshold: int, name: str) -> None:
    now = time()

    if feed_path.exists():
        age = now - feed_path.stat().st_mtime
    else:
        age = cache_seconds

    if age < cache_seconds:
        return

    request_url = f'{route_url}/{request}'
    response = requests.get(request_url)
    response.raise_for_status()
    data = response.json()

    if feed_path.exists():
        with open(feed_path) as f:
            feed_xml = f.read()

        feed = xmltodict.parse(feed_xml)

        if not isinstance(feed['rss']['channel']['item'], list):
            feed['rss']['channel']['item'] = [feed['rss']['channel']['item']]

        distance_last = float(feed['rss']['channel']['item'][0]['distance'])
    else:
        feed = {
            'rss': {
                '@version': '2.0',
                'channel': {
                    'title': 'osm-route-distance-feed',
                    'description': 'This RSS feed notifies of distance changes on a given OpenStreetMap route.',
                    'link': request_url,
                    'item': [],

                    # -- custom --
                    'threshold': threshold,
                    'name': name
                }
            }
        }

        distance_last = 1

    pubdate_format = 'EEE, dd LLL yyyy HH:mm:ss'
    pubdate = format_datetime(now, pubdate_format, locale='en') + ' GMT'
    feed['rss']['channel']['pubDate'] = pubdate
    feed['rss']['channel']['ttl'] = str(int(cache_seconds))

    distance_now = float(data['routes'][0]['distance'])
    distance_change = distance_now - distance_last

    if abs(distance_change) >= threshold or not feed['rss']['channel']['item']:
        distance_change_perc = distance_change / distance_last
        distance_now_km = distance_now / 1000
        distance_last_km = distance_last / 1000

        feed['rss']['channel']['item'] = [{
            'title': f'Distance changed by {distance_change_perc:+.3%}',
            'description':
                f'The route "{name}" distance was changed from {distance_last_km:.2F} km. to {distance_now_km:.2F} km.'
                if name else
                f'The route distance was changed from {distance_last_km:.2F} km. to {distance_now_km:.2F} km.',
            'link': request_url,
            'pubDate': pubdate,

            # -- custom --
            'distance': data['routes'][0]['distance']
        }] + feed['rss']['channel']['item'][:rss_max_size - 1]

    feed_xml = xmltodict.unparse(feed)

    with open(feed_path, 'w') as f:
        f.write(feed_xml)


@app.get('/rss/{request:path}')
def rss(request: str, threshold: int = Query(50, ge=0), name: str = Query("")):
    request = request.strip('/')
    feed_path = get_feed_path(request, threshold, name)

    update_cache(feed_path, request, threshold, name)

    return FileResponse(feed_path, media_type='application/rss+xml')
