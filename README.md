QueryGeoBoundary
---
A Node.js library to query the geo (administrative area) boundary from OSM nominatim and/or overpass.

Usage
---
```ts
import { queryGeoBoundary } from 'query-geo-boundary';
// CommonJS: const { queryGeoBoundary } = require('query-geo-boundary');

const places = await queryGeoBoundary('Zhucheng, Shandong', { userAgent: 'my-app/1.0 (ops@example.com)' });
for (const place of places) {
    console.log(place.display_name, place.geojson);
}
```

The package ships ESM and CommonJS builds with TypeScript declarations. `queryGeoBoundary` is also the default export; the option and result types are exported as `QueryGeoBoundaryOptions` and `GeoBoundaryPlace`.

API
---
**Prototype**: `queryGeoBoundary(geoName, options)`
  - *`geoName`*: name of the geo you want to obtain its boundary
  - *`options`*: optional.
    - `source`: `'nominatim'` (default, recommended) queries [Nominatim](https://nominatim.openstreetmap.org/) once with `polygon_geojson`; `'overpass'` looks the place up on Nominatim, then fetches each boundary from [Overpass](https://overpass-api.de/) (much slower, and rate-limited).
    - `userAgent`: the User-Agent sent to both services. Defaults to `query-geo-boundary/<version> (+https://github.com/tibetty/QueryGeoBoundary)`. The [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) asks applications to identify themselves, so set this to your app's name and contact.

**Return**: a promise of the matching OSM relations (`GeoBoundaryPlace[]`), as Nominatim describes them, with the boundary under `geojson`. With the `nominatim` source, `geojson` is Nominatim's geometry; with `overpass`, it is the [osm2geojson-lite](https://www.npmjs.com/package/osm2geojson-lite) conversion of the relation. A typical result:
```json
[{
    "place_id": 220758967,
    "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright",
    "osm_type": "relation",
    "osm_id": 3468769,
    "lat": "35.9957253",
    "lon": "119.4041185",
    "class": "boundary",
    "type": "administrative",
    "display_name": "诸城市, 潍坊市, 山东省, 262200, 中国",
    "boundingbox": ["35.7163774", "36.2834811", "118.9952393", "119.7232973"],
    "geojson": {"type": "Polygon", "coordinates": [[[118.9952393, 36.0120809], "...", [118.9952393, 36.0120809]]]}
}]
```
**Errors**: the promise rejects with an `Error`. HTTP failures name the service and status in the message and set `err.status` (e.g. `429` when Overpass rate-limits you).

**Notice**: 'coz it's very common for an administrative uint has the same name with the others, if you want to get the boundary of exactly that place, please supply as much as possible hierarchical adminstrative information in name, e.g., using "Ikeda, Hokkaido" rather than "Ikeda", or you can solve this kind of ambiguity by introducing human interference.

Node.JS Requirement
---
  - Node.js 22+
  
Dependency
---
  - [osm2geojson-lite](https://www.npmjs.com/package/osm2geojson-lite) - a regex and map accelerated xml parsing & geojson reconstruction utility, much faster than [xmldom](https://github.com/jindw/xmldom), [osmtogeojson](https://github.com/tyrasd/osmtogeojson) in combination to convert an OSM XML to geojson

License
---
[MIT](LICENSE)
