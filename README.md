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
  - *`options`*: optional. only support `source` option right now, you can use `{source: 'overpass'}` to mandata it to go through [overpass](https://overpass-api.de/) service (very slow, and has concurrency limitation), by default (and highly-recommended) it will use openstreetmap [nominatim](https://nominatim.openstreetmap.org/) service.

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
  - Node.JS 4.x+ with ES6 features supports
  
Dependency
---
  - request - basic version and basic function (can be easily replaced by built-in http module)
  - xml2geojson-lite - a RegExp and Map accelerated XML parsing & geojson reconstruction utility, about **8X** faster than [xmldom](https://github.com/jindw/xmldom), *osmtogeojson* in combination to accomplish the same task
