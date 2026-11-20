// Live demo against the public services: node examples/query.mjs [name] [nominatim|overpass]
import { queryGeoBoundary } from '../dist/index.mjs';

const [name = '諸城', source = 'nominatim'] = process.argv.slice(2);
const places = await queryGeoBoundary(name, { source, userAgent: 'query-geo-boundary-example' });
for (const place of places) {
    console.log(place.osm_id, place.display_name, place.geojson?.type);
}
