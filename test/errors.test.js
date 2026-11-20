'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const queryGeoBoundary = require('..');
const { stubFetch, place, NOMINATIM, OVERPASS } = require('./helpers');

test('Nominatim HTTP failure rejects with an Error carrying the status', async t => {
	stubFetch(t, { [NOMINATIM]: () => ({ status: 503, body: 'busy' }) });
	await assert.rejects(queryGeoBoundary('x'), err => {
		assert.ok(err instanceof Error);
		assert.match(err.message, /Nominatim.*503 Service Unavailable/);
		assert.equal(err.status, 503);
		return true;
	});
});

test('Overpass HTTP failure rejects with an Error carrying the status', async t => {
	stubFetch(t, {
		[NOMINATIM]: () => ({ body: [place(1)] }),
		[OVERPASS]: () => ({ status: 429, body: 'rate limited' }),
	});
	await assert.rejects(queryGeoBoundary('x', { source: 'overpass' }), err => {
		assert.ok(err instanceof Error);
		assert.match(err.message, /Overpass.*429 Too Many Requests/);
		assert.equal(err.status, 429);
		return true;
	});
});

test('a non-JSON Nominatim body rejects with an Error naming the service', async t => {
	stubFetch(t, { [NOMINATIM]: () => ({ body: '<html>maintenance</html>' }) });
	await assert.rejects(queryGeoBoundary('x'), err => {
		assert.ok(err instanceof Error);
		assert.match(err.message, /Nominatim returned an invalid JSON response/);
		assert.ok(err.cause instanceof SyntaxError);
		return true;
	});
});
