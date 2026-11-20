import { vi } from 'vitest';

export const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
export const OVERPASS = 'https://overpass-api.de/api/interpreter';

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

/** An Overpass answer holding one closed boundary relation. */
export function overpassXml(relId: number): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6">
  <relation id="${relId}">
    <bounds minlat="0" minlon="0" maxlat="1" maxlon="1"/>
    <member type="way" ref="1" role="outer">
      <nd lat="0" lon="0"/><nd lat="0" lon="1"/><nd lat="1" lon="1"/><nd lat="0" lon="0"/>
    </member>
    <tag k="boundary" v="administrative"/>
    <tag k="type" v="boundary"/>
  </relation>
</osm>`;
}

export const areaQuery = (call: FetchCall) => new URLSearchParams(String(call.init.body)).get('data');
export const userAgent = (call: FetchCall) => new Headers(call.init.headers).get('user-agent');
