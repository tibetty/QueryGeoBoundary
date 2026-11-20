import type { FeatureCollection } from 'geojson';
import osm2geojson from 'osm2geojson-lite';
import { vi } from 'vitest';

export const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
export const OVERPASS = 'https://overpass-api.de/api/interpreter';
export const OVERPASS_COFFEE = 'https://overpass.private.coffee/api/interpreter';
export const OVERPASS_VK = 'https://maps.mail.ru/osm/tools/overpass/api/interpreter';

export interface FetchCall {
    url: string;
    init: RequestInit;
}

type Route = (url: string, init: RequestInit) => { status?: number; body?: unknown } | Promise<{ status?: number; body?: unknown }>;

/** Replaces global fetch for one test; `routes` maps a URL prefix to a responder. Returns the recorded calls. */
export function stubFetch(routes: Record<string, Route>): FetchCall[] {
    const calls: FetchCall[] = [];
    vi.stubGlobal('fetch', async (input: string | URL, init: RequestInit = {}) => {
        const url = String(input);
        calls.push({ url, init });
        const prefix = Object.keys(routes).find(p => url.startsWith(p));
        if (!prefix) throw new Error(`unexpected fetch: ${url}`);
        const { status = 200, body = '' } = await routes[prefix](url, init);
        return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
    });
    return calls;
}

/** A Nominatim hit; `osm_id` is numeric, as Nominatim returns it today. */
export function place(osmId: number | string, extra: Record<string, unknown> = {}) {
    return { place_id: Number(osmId) + 1, osm_type: 'relation', osm_id: osmId, display_name: `place ${osmId}`, ...extra };
}

/** One closed boundary relation, as Overpass returns it with `out geom`. */
function relationXml(relId: number): string {
    return `  <relation id="${relId}">
    <bounds minlat="0" minlon="0" maxlat="${relId}" maxlon="${relId}"/>
    <member type="way" ref="${relId}" role="outer">
      <nd lat="0" lon="0"/><nd lat="0" lon="${relId}"/><nd lat="${relId}" lon="${relId}"/><nd lat="0" lon="0"/>
    </member>
    <tag k="boundary" v="administrative"/>
    <tag k="type" v="boundary"/>
  </relation>`;
}

/** An Overpass answer holding one boundary relation per id. */
export function overpassXml(...relIds: number[]): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6">
${relIds.map(relationXml).join('\n')}
</osm>`;
}

/** The geometry query-geo-boundary attaches for relation `relId` of an Overpass answer. */
export function geometryOf(xml: string, relId: number) {
    const collection = osm2geojson(xml, { completeFeature: true }) as FeatureCollection;
    return collection.features.find(f => f.id === `relation/${relId}`)!.geometry;
}

export const overpassQuery = (call: FetchCall) => new URLSearchParams(String(call.init.body)).get('data');
export const userAgent = (call: FetchCall) => new Headers(call.init.headers).get('user-agent');
