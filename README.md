QueryGeoBoundary
---
A Node.js library to query the geo (administrative area) boundary from OSM nominatim and/or overpass.

Usage
---
```js
const queryGeoBoundary = require('query-geo-boundary');
queryGeoBoundary(`${geo_name}`).then(boundaries => {
  // your post-processing here
}).catch(err => {
  // your error handling here
});
```

API
---
**Prototype**: `queryGeoBoundary(geoName, options)`
  - *`geoName`*: name of the geo you want to obtain its boundary
  - *`options`*: optional.
    - `source`: `'nominatim'` (default, recommended) queries [Nominatim](https://nominatim.openstreetmap.org/) once with `polygon_geojson`; `'overpass'` looks the place up on Nominatim, then fetches each boundary from [Overpass](https://overpass-api.de/) (much slower, and rate-limited).
    - `userAgent`: the User-Agent sent to both services. Defaults to `query-geo-boundary/<version> (+https://github.com/tibetty/QueryGeoBoundary)`. The [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) asks applications to identify themselves, so set this to your app's name and contact.

**Return**: an array of osm places with boundary geojson (the place attributes include displayname, lat/lon, boundingbox, and the boundary geojson under "geojson"). A typical result is as below:
```js
  [{"place_id":"158973269",
  "licence":"Data © OpenStreetMap contributors, ODbL 1.0. http://www.openstreetmap.org/copyright",
  "osm_type":"relation",
  "osm_id":"3468769",
  "boundingbox":["35.7163774","36.2834811","118.9952393","119.7232973"],"lat":"35.9989034","lon":"119.342173467495",
  "display_name":"诸城市, 潍坊市, 山东省, 中国",
  "class":"boundary",
  "type":"administrative",
  "importance":0.43599614036271,
  "icon":"https://nominatim.openstreetmap.org/images/mapicons/poi_boundary_administrative.p.20.png",
  "geojson":{"type":"Polygon","coordinates":[[[118.9952393,36.0120809],...,[118.9952393,36.0120809]]]}}]
```
**Notice**: 'coz it's very common for an administrative uint has the same name with the others, if you want to get the boundary of exactly that place, please supply as much as possible hierarchical adminstrative information in name, e.g., using "Ikeda, Hokkaido" rather than "Ikeda", or you can solve this kind of ambiguity by introducing human interference.

Node.JS Requirement
---
  - Node.js 18+ (uses the built-in `fetch`)
  
Dependency
---
  - [osm2geojson-lite](https://www.npmjs.com/package/osm2geojson-lite) - a regex and map accelerated xml parsing & geojson reconstruction utility, much faster than [xmldom](https://github.com/jindw/xmldom), [osmtogeojson](https://github.com/tyrasd/osmtogeojson) in combination to convert an OSM XML to geojson

License
---
[MIT](LICENSE)
