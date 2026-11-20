'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const queryGeoBoundary = require('..');

test('exports a function taking a name and options', () => {
	assert.equal(typeof queryGeoBoundary, 'function');
});
