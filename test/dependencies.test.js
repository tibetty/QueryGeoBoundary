'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pkg = require('../package.json');

test('depends on osm2geojson-lite 3.x and declares its Node floor', () => {
	assert.equal(pkg.dependencies['osm2geojson-lite'], '^3.0.0');
	assert.equal(pkg.engines.node, '>=22');
});
