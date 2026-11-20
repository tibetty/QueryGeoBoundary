import { describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import queryGeoBoundaryDefault, { queryGeoBoundary } from '../src/index';
import { behaviour } from './query';

describe('source', () => {
    it('exports the same function as default and named export', () => {
        expect(queryGeoBoundaryDefault).toBe(queryGeoBoundary);
    });
    behaviour(queryGeoBoundary);
});

describe('package manifest', () => {
    it('depends on osm2geojson-lite 3.x with no HTTP client, and declares Node 22+', () => {
        expect(pkg.dependencies).toEqual({ 'osm2geojson-lite': '^3.0.0' });
        expect(pkg.engines.node).toBe('>=22');
    });
});
