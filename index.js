'use strict';

const http = require('http');
const osm2geojson = require('osm2geojson-lite');

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Nominatim's usage policy requires an identifying User-Agent; Overpass rejects spoofed browser ones.
const DEFAULT_USER_AGENT = `query-geo-boundary/${require('./package.json').version} (+https://github.com/tibetty/QueryGeoBoundary)`;

async function fetchText(service, url, init, opts) {
	const response = await fetch(url, {...init, headers: {'User-Agent': opts.userAgent || DEFAULT_USER_AGENT}});
	if (response.status !== 200) {
		const err = new Error(`${service} request failed: HTTP ${response.status} ${http.STATUS_CODES[response.status] || ''}`.trim());
		err.status = response.status;
		throw err;
	}
	return response.text();
}

async function searchRelations(name, params, opts) {
	const url = `${NOMINATIM_URL}?${new URLSearchParams({format: 'json', q: `${name}`, ...params})}`;
	const body = await fetchText('Nominatim', url, {}, opts);
	let places;
	try {
		places = JSON.parse(body);
	} catch (cause) {
		throw new Error('Nominatim returned an invalid JSON response', {cause});
	}
	return places.filter(place => place.osm_type === 'relation');
}

// a slower way - query from overpass
async function queryFromOverpass(name, opts) {
	function getBoundary(areaId) {
		return fetchText('Overpass', OVERPASS_URL, {
			method: 'POST',
			body: new URLSearchParams({data: `area(${areaId});rel(pivot);out geom;`}),
		}, opts).then(body => osm2geojson(body));
	}

	const areas = await searchRelations(name, {}, opts);
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
function queryFromOpenStreetMap(name, opts) {
	return searchRelations(name, {polygon_geojson: 1}, opts);
}

module.exports = (name, opts = {}) => {
	if (opts.source === 'overpass') return queryFromOverpass(name, opts);
	return queryFromOpenStreetMap(name, opts);
};
