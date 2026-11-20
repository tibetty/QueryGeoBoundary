'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const queryGeoBoundary = require('..');
const { version } = require('../package.json');
const { stubFetch, place, overpassXml, NOMINATIM, OVERPASS } = require('./helpers');

const userAgents = calls => calls.map(c => new Headers(c.init.headers).get('user-agent'));
const routes = () => ({
	[NOMINATIM]: () => ({ body: [place(1)] }),
	[OVERPASS]: () => ({ body: overpassXml(1) }),
});

test('default User-Agent identifies the library on every request', async t => {
	const calls = stubFetch(t, routes());
	await queryGeoBoundary('x', { source: 'overpass' });
	const expected = `query-geo-boundary/${version} (+https://github.com/tibetty/QueryGeoBoundary)`;
	assert.deepEqual(userAgents(calls), [expected, expected]);
});

for (const source of ['nominatim', 'overpass']) {
	test(`userAgent option replaces the default (${source})`, async t => {
		const calls = stubFetch(t, routes());
		await queryGeoBoundary('x', { source, userAgent: 'my-app/1.0 (ops@example.com)' });
		assert.ok(calls.length > 0);
		assert.ok(userAgents(calls).every(ua => ua === 'my-app/1.0 (ops@example.com)'));
	});
}
