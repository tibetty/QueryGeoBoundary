'use strict';

const http = require('http');
const osm2geojson = require('osm2geojson-lite');

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// to minic accesses from a browser so as to avoid being blocked
const headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36'};

async function fetchText(url, init) {
	const response = await fetch(url, {...init, headers});
	if (response.status !== 200) throw http.STATUS_CODES[response.status];
	return response.text();
}

async function searchRelations(name, params) {
	const url = `${NOMINATIM_URL}?${new URLSearchParams({format: 'json', q: `${name}`, ...params})}`;
	const places = JSON.parse(await fetchText(url));
	return places.filter(place => place.osm_type === 'relation');
}

// a slower way - query from overpass
async function queryFromOverpass(name) {
	function getBoundary(areaId) {
		return fetchText(OVERPASS_URL, {
			method: 'POST',
			body: new URLSearchParams({data: `area(${areaId});rel(pivot);out geom;`}),
		}).then(body => osm2geojson(body));
	}

	const areas = await searchRelations(name);
	const promised = [];
	for (let area of areas) {
		// Overpass derives an area id from a relation id by adding this offset.
		const RELATION_AREA_OFFSET = 3600000000;
		promised.push(getBoundary(RELATION_AREA_OFFSET + Number(area.osm_id)));
	}
	const geojsons = await Promise.all(promised);
	for (let idx in areas)
		areas[idx].geojson = geojsons[idx];
	return areas;
}

// a much faster way - query from osm (OpenStreetMap), mostly 'coz there is only 1 internet access
function queryFromOpenStreetMap(name) {
	return searchRelations(name, {polygon_geojson: 1});
}

module.exports = (name, opts) => {
	if (opts && opts.source === 'overpass') return queryFromOverpass(name);
	return queryFromOpenStreetMap(name);
};
