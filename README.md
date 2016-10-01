# QueryGeoBoundary
A Node.js Module to Query the Geo (Administrative Area) Boundary from OSM nominatim and/or overpass (with a RegExp & Map turboed XML parser & geojson constructor for boundary polygon/multi-polygon, <b>3x</b> faster than <a href="https://github.com/tyrasd/osmtogeojson">osmtogeojson</a> only, and almost <b>7x</b> faster than <a href="https://github.com/jindw/xmldom">xmldom</a>, osmtogejson in combination to accomplish the same task.

# Usage
var queryGeoBoundary = require('query-geo-boundary');</br>
queryGeoBoundary('&lt;geo unit name to query&gt;').then(boundaries &#61;&gt; {</br>
  // your post-processing here</br>
}).catch(err &#61;&gt; {</br>
  // your error handling here</br>
});

# API
+ <b>Prototype</b>: queryGeoBoundary(geoName, options)
  - <i>geoName</i>: the the geo name you want to obtain its boundary
  - <i>options</i>: optional. only support "source" option right now, you can use {source: 'overpass'} to mandata it to go through overpass (very slow, and has concurrency limitation), by default (and highly-recommended) it will use nominatim service.
+ <b>Return</b>: an array of osm place with boundary geojson (the place attributes include displayname, lat/lon, boundingbox, and the boundary geojson under "geojson"), a typical result is as below:<br/>
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
  "<b>geojson</b>":{"type":"Polygon","coordinates":[[[118.9952393,36.0120809],...,[118.9952393,36.0120809]]]}}]
+ <b>Notice</b>: 'coz it's very common for an administrative uint has the same name with others, if you want to get the boundary of exactly that place, please supply as much as possible hierarchical adminstrative information in name, e.g., using "Ikeda, Hokkaido" rather than "Ikeda", or you can solve this kind of ambiguity by introducing human interference.

# Node.JS version
  - 4.x+ with majore ES 6 features supports
  
# Dependency
  - request - basic version and basic function (can be easily replaced by built-in http module)
