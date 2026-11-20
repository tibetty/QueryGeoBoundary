'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { setTimeout: sleep } = require('node:timers/promises');
const osm2geojson = require('osm2geojson-lite');
const queryGeoBoundary = require('..');
const { stubFetch, place, overpassXml, NOMINATIM, OVERPASS } = require('./helpers');

test('overpass source sends one Overpass request at a time, in Nominatim order', async t => {
	let inFlight = 0;
	let maxInFlight = 0;
	const calls = stubFetch(t, {
		[NOMINATIM]: () => ({ body: [place(3), place(1), place(2)] }),
		[OVERPASS]: async (url, init) => {
			maxInFlight = Math.max(maxInFlight, ++inFlight);
			await sleep(5);
			inFlight--;
			const areaId = Number(/area\((\d+)\)/.exec(new URLSearchParams(init.body).get('data'))[1]);
			return { body: overpassXml(areaId - 3600000000) };
		},
	});
	const result = await queryGeoBoundary('x', { source: 'overpass' });
	assert.equal(maxInFlight, 1);
	assert.deepEqual(calls.slice(1).map(c => new URLSearchParams(c.init.body).get('data')),
		[3600000003, 3600000001, 3600000002].map(id => `area(${id});rel(pivot);out geom;`));
	assert.deepEqual(result.map(p => p.geojson), [3, 1, 2].map(id => osm2geojson(overpassXml(id))));
});
