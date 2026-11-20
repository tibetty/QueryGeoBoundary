'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const osm2geojson = require('osm2geojson-lite');
const queryGeoBoundary = require('..');
const { stubFetch, place, overpassXml, NOMINATIM, OVERPASS } = require('./helpers');

test('nominatim source: one fetch with polygon_geojson, keeps only relations', async t => {
	const calls = stubFetch(t, {
		[NOMINATIM]: () => ({ body: [place(1, { geojson: { type: 'Polygon' } }), { osm_type: 'node', osm_id: 2 }] }),
	});
	const result = await queryGeoBoundary('Zhucheng');
	assert.equal(calls.length, 1);
	const url = new URL(calls[0].url);
	assert.equal(url.searchParams.get('q'), 'Zhucheng');
	assert.equal(url.searchParams.get('format'), 'json');
	assert.equal(url.searchParams.get('polygon_geojson'), '1');
	assert.deepEqual(result.map(p => p.osm_id), [1]);
	assert.deepEqual(result[0].geojson, { type: 'Polygon' });
});

test('overpass source: searches Nominatim, then POSTs the area query to Overpass', async t => {
	const calls = stubFetch(t, {
		[NOMINATIM]: () => ({ body: [place(42)] }),
		[OVERPASS]: () => ({ body: overpassXml(42) }),
	});
	const result = await queryGeoBoundary('Zhucheng', { source: 'overpass' });
	assert.equal(calls.length, 2);
	assert.equal(new URL(calls[0].url).searchParams.get('polygon_geojson'), null);
	assert.equal(calls[1].init.method, 'POST');
	assert.match(new URLSearchParams(calls[1].init.body).get('data'), /^area\(\d+\);rel\(pivot\);out geom;$/);
	assert.equal(result.length, 1);
	assert.deepEqual(result[0].geojson, osm2geojson(overpassXml(42)));
});

test('package has no HTTP-client dependency', () => {
	assert.equal(require('../package.json').dependencies.request, undefined);
});
