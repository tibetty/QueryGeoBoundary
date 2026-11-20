'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const queryGeoBoundary = require('..');
const { stubFetch, place, overpassXml, NOMINATIM, OVERPASS } = require('./helpers');

async function areaQueryFor(t, osmId) {
	const calls = stubFetch(t, {
		[NOMINATIM]: () => ({ body: [place(osmId)] }),
		[OVERPASS]: () => ({ body: overpassXml(1) }),
	});
	await queryGeoBoundary('x', { source: 'overpass' });
	return new URLSearchParams(calls[1].init.body).get('data');
}

for (const [osmId, areaId] of [
	[3468769, 3603468769], // numeric, as Nominatim returns it today
	['3468769', 3603468769], // string, as older Nominatim versions did
	[400000000, 4000000000], // 9 digits: string padding gave 3400000000
]) {
	test(`relation ${JSON.stringify(osmId)} maps to area ${areaId}`, async t => {
		assert.equal(await areaQueryFor(t, osmId), `area(${areaId});rel(pivot);out geom;`);
	});
}
