import { describe, expect, it, vi } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import type { queryGeoBoundary as QueryGeoBoundary } from '../src/index';
import { geometryOf, NOMINATIM, OVERPASS, OVERPASS_COFFEE, OVERPASS_VK, overpassQuery, overpassXml, place, stubFetch, userAgent } from './helpers';

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
        const query = (...ids: (number | string)[]) => `[out:xml][timeout:60];rel(id:${ids.join(',')});out geom;`;

        it('fetches every relation in one Overpass request and splits it per place', async () => {
            const xml = overpassXml(3, 1, 2);
            const calls = stubFetch({
                [NOMINATIM]: () => ({ body: [place(3), place(1), place(2)] }),
                [OVERPASS]: () => ({ body: xml }),
            });
            const result = await queryGeoBoundary('Zhucheng', { source: 'overpass' });
            expect(calls).toHaveLength(2);
            expect(new URL(calls[0].url).searchParams.get('polygon_geojson')).toBeNull();
            expect(calls[1].init.method).toBe('POST');
            expect(calls[1].init.signal).toBeInstanceOf(AbortSignal);
            expect(overpassQuery(calls[1])).toBe(query(3, 1, 2));
            expect(result.map(p => p.osm_id)).toEqual([3, 1, 2]);
            expect(result.map(p => p.geojson)).toEqual([3, 1, 2].map(id => geometryOf(xml, id)));
        });

        it('accepts string osm_ids', async () => {
            const calls = stubFetch({
                [NOMINATIM]: () => ({ body: [place('3468769')] }),
                [OVERPASS]: () => ({ body: overpassXml(3468769) }),
            });
            const [result] = await queryGeoBoundary('x', { source: 'overpass' });
            expect(overpassQuery(calls[1])).toBe(query('3468769'));
            expect(result.geojson).toBeDefined();
        });

        it('leaves geojson unset for a relation Overpass did not return', async () => {
            stubFetch({
                [NOMINATIM]: () => ({ body: [place(1), place(2)] }),
                [OVERPASS]: () => ({ body: overpassXml(1) }),
            });
            const result = await queryGeoBoundary('x', { source: 'overpass' });
            expect(result[0].geojson).toBeDefined();
            expect(result[1].geojson).toBeUndefined();
        });

        it('skips Overpass when Nominatim finds no relation', async () => {
            const calls = stubFetch({ [NOMINATIM]: () => ({ body: [] }) });
            expect(await queryGeoBoundary('x', { source: 'overpass' })).toEqual([]);
            expect(calls).toHaveLength(1);
        });

        it.each([
            ['HTTP 429', () => ({ status: 429 })],
            ['HTTP 502', () => ({ status: 502 })],
            ['HTTP 504', () => ({ status: 504 })],
            ['a network error', () => { throw new TypeError('fetch failed'); }],
            ['a client timeout', () => { throw new DOMException('timed out', 'TimeoutError'); }],
        ])('falls back to the next endpoint on %s', async (_label, fail) => {
            const calls = stubFetch({
                [NOMINATIM]: () => ({ body: [place(1)] }),
                [OVERPASS]: fail,
                [OVERPASS_COFFEE]: () => ({ body: overpassXml(1) }),
            });
            const [result] = await queryGeoBoundary('x', { source: 'overpass' });
            expect(calls.map(c => c.url)).toEqual([expect.stringContaining(NOMINATIM), OVERPASS, OVERPASS_COFFEE]);
            expect(result.geojson).toBeDefined();
        });

        it('rejects at once on a non-retryable HTTP error', async () => {
            const calls = stubFetch({
                [NOMINATIM]: () => ({ body: [place(1)] }),
                [OVERPASS]: () => ({ status: 400, body: 'syntax error' }),
            });
            const err = await queryGeoBoundary('x', { source: 'overpass' }).catch((e: unknown) => e);
            expect((err as Error).message).toMatch(/Overpass.*400 Bad Request/);
            expect((err as { status?: number }).status).toBe(400);
            expect(calls).toHaveLength(2);
        });

        it('retries every endpoint after 15 s and 30 s, then rejects with the last error', async () => {
            vi.useFakeTimers();
            try {
                const calls = stubFetch({
                    [NOMINATIM]: () => ({ body: [place(1)] }),
                    [OVERPASS]: () => ({ status: 502 }),
                    [OVERPASS_COFFEE]: () => ({ status: 504 }),
                    [OVERPASS_VK]: () => ({ status: 429 }),
                });
                const pending = queryGeoBoundary('x', { source: 'overpass' }).catch((e: unknown) => e);
                await vi.advanceTimersByTimeAsync(14_999);
                expect(calls).toHaveLength(1 + 3);
                await vi.advanceTimersByTimeAsync(1);
                expect(calls).toHaveLength(1 + 6);
                await vi.advanceTimersByTimeAsync(29_999);
                expect(calls).toHaveLength(1 + 6);
                await vi.advanceTimersByTimeAsync(1);
                const err = await pending;
                expect(calls).toHaveLength(1 + 9);
                expect((err as Error).message).toMatch(/Overpass.*429 Too Many Requests/);
            } finally {
                vi.useRealTimers();
            }
        });

        it('recovers on a later round', async () => {
            vi.useFakeTimers();
            try {
                let attempts = 0;
                stubFetch({
                    [NOMINATIM]: () => ({ body: [place(1)] }),
                    [OVERPASS]: () => (++attempts === 1 ? { status: 502 } : { body: overpassXml(1) }),
                });
                const pending = queryGeoBoundary('x', { source: 'overpass', overpassUrl: OVERPASS });
                await vi.advanceTimersByTimeAsync(15_000);
                const [result] = await pending;
                expect(attempts).toBe(2);
                expect(result.geojson).toBeDefined();
            } finally {
                vi.useRealTimers();
            }
        });

        it('uses only the endpoints given by overpassUrl', async () => {
            const custom = 'https://overpass.example.org/api/interpreter';
            const calls = stubFetch({
                [NOMINATIM]: () => ({ body: [place(1)] }),
                [custom]: () => ({ body: overpassXml(1) }),
            });
            await queryGeoBoundary('x', { source: 'overpass', overpassUrl: [custom] });
            expect(calls[1].url).toBe(custom);
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
