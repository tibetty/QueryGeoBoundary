import { setTimeout as sleep } from 'node:timers/promises';
import osm2geojson from 'osm2geojson-lite';
import { describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import type { queryGeoBoundary as QueryGeoBoundary } from '../src/index';
import { areaQuery, NOMINATIM, OVERPASS, overpassXml, place, stubFetch, userAgent } from './helpers';

/** The behaviour suite, run against the source and against each built entry. */
export function behaviour(queryGeoBoundary: typeof QueryGeoBoundary) {
    describe('nominatim source', () => {
        it('makes one request with polygon_geojson and keeps only relations', async () => {
            const calls = stubFetch({
                [NOMINATIM]: () => ({ body: [place(1, { geojson: { type: 'Polygon' } }), { osm_type: 'node', osm_id: 2 }] }),
            });
            const result = await queryGeoBoundary('Zhucheng');
            expect(calls).toHaveLength(1);
            const params = new URL(calls[0].url).searchParams;
            expect(params.get('q')).toBe('Zhucheng');
            expect(params.get('format')).toBe('json');
            expect(params.get('polygon_geojson')).toBe('1');
            expect(result.map(p => p.osm_id)).toEqual([1]);
            expect(result[0].geojson).toEqual({ type: 'Polygon' });
        });
    });

    describe('overpass source', () => {
        it('searches Nominatim, then POSTs the area query to Overpass', async () => {
            const calls = stubFetch({
                [NOMINATIM]: () => ({ body: [place(42)] }),
                [OVERPASS]: () => ({ body: overpassXml(42) }),
            });
            const result = await queryGeoBoundary('Zhucheng', { source: 'overpass' });
            expect(calls).toHaveLength(2);
            expect(new URL(calls[0].url).searchParams.get('polygon_geojson')).toBeNull();
            expect(calls[1].init.method).toBe('POST');
            expect(areaQuery(calls[1])).toBe('area(3600000042);rel(pivot);out geom;');
            expect(result[0].geojson).toEqual(osm2geojson(overpassXml(42)));
        });

        it.each([
            [3468769, 3603468769],
            ['3468769', 3603468769],
            [400000000, 4000000000],
        ])('maps relation %j to area %i', async (osmId, areaId) => {
            const calls = stubFetch({
                [NOMINATIM]: () => ({ body: [place(osmId)] }),
                [OVERPASS]: () => ({ body: overpassXml(1) }),
            });
            await queryGeoBoundary('x', { source: 'overpass' });
            expect(areaQuery(calls[1])).toBe(`area(${areaId});rel(pivot);out geom;`);
        });

        it('sends one request at a time, in Nominatim order', async () => {
            let inFlight = 0;
            let maxInFlight = 0;
            const calls = stubFetch({
                [NOMINATIM]: () => ({ body: [place(3), place(1), place(2)] }),
                [OVERPASS]: async (_url, init) => {
                    maxInFlight = Math.max(maxInFlight, ++inFlight);
                    await sleep(5);
                    inFlight--;
                    const areaId = Number(/area\((\d+)\)/.exec(String(new URLSearchParams(String(init.body)).get('data')))![1]);
                    return { body: overpassXml(areaId - 3600000000) };
                },
            });
            const result = await queryGeoBoundary('x', { source: 'overpass' });
            expect(maxInFlight).toBe(1);
            expect(calls.slice(1).map(areaQuery)).toEqual(
                [3600000003, 3600000001, 3600000002].map(id => `area(${id});rel(pivot);out geom;`));
            expect(result.map(p => p.geojson)).toEqual([3, 1, 2].map(id => osm2geojson(overpassXml(id))));
        });
    });

    describe('User-Agent', () => {
        const routes = () => ({
            [NOMINATIM]: () => ({ body: [place(1)] }),
            [OVERPASS]: () => ({ body: overpassXml(1) }),
        });

        it('identifies the library by default on every request', async () => {
            const calls = stubFetch(routes());
            await queryGeoBoundary('x', { source: 'overpass' });
            const expected = `query-geo-boundary/${pkg.version} (+https://github.com/tibetty/QueryGeoBoundary)`;
            expect(calls.map(userAgent)).toEqual([expected, expected]);
        });

        it.each(['nominatim', 'overpass'] as const)('is replaced by the userAgent option (%s)', async source => {
            const calls = stubFetch(routes());
            await queryGeoBoundary('x', { source, userAgent: 'my-app/1.0 (ops@example.com)' });
            expect(calls.length).toBeGreaterThan(0);
            expect(calls.map(userAgent).every(ua => ua === 'my-app/1.0 (ops@example.com)')).toBe(true);
        });
    });

    describe('errors', () => {
        it('rejects with an Error carrying the status on a Nominatim HTTP failure', async () => {
            stubFetch({ [NOMINATIM]: () => ({ status: 503, body: 'busy' }) });
            const err = await queryGeoBoundary('x').catch((e: unknown) => e);
            expect(err).toBeInstanceOf(Error);
            expect((err as Error).message).toMatch(/Nominatim.*503 Service Unavailable/);
            expect((err as { status?: number }).status).toBe(503);
        });

        it('rejects with an Error carrying the status on an Overpass HTTP failure', async () => {
            stubFetch({
                [NOMINATIM]: () => ({ body: [place(1)] }),
                [OVERPASS]: () => ({ status: 429, body: 'rate limited' }),
            });
            const err = await queryGeoBoundary('x', { source: 'overpass' }).catch((e: unknown) => e);
            expect(err).toBeInstanceOf(Error);
            expect((err as Error).message).toMatch(/Overpass.*429 Too Many Requests/);
            expect((err as { status?: number }).status).toBe(429);
        });

        it('omits the reason phrase for a status Node does not name', async () => {
            stubFetch({ [NOMINATIM]: () => ({ status: 599, body: '' }) });
            const err = await queryGeoBoundary('x').catch((e: unknown) => e);
            expect((err as Error).message).toBe('Nominatim request failed: HTTP 599');
        });

        it('rejects with an Error naming the service on a non-JSON Nominatim body', async () => {
            stubFetch({ [NOMINATIM]: () => ({ body: '<html>maintenance</html>' }) });
            const err = await queryGeoBoundary('x').catch((e: unknown) => e);
            expect((err as Error).message).toMatch(/Nominatim returned an invalid JSON response/);
            expect((err as Error).cause).toBeInstanceOf(SyntaxError);
        });
    });
}
