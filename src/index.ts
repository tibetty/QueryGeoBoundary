import { STATUS_CODES } from 'node:http';
import type { FeatureCollection, GeoJSON } from 'geojson';
import osm2geojson from 'osm2geojson-lite';
import { version } from '../package.json' with { type: 'json' };

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/** Public Overpass instances, tried in order (https://wiki.openstreetmap.org/wiki/Overpass_API). */
const OVERPASS_URLS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

/** Waits before the second and third round over the Overpass endpoints. */
const OVERPASS_BACKOFF_MS = [15_000, 30_000];

/** Overpass aborts a query after this many seconds; a short limit is admitted more readily. */
const OVERPASS_QUERY_TIMEOUT_S = 60;

/** Client-side limit per Overpass request, so a hung endpoint falls through to the next. */
const OVERPASS_REQUEST_TIMEOUT_MS = 90_000;

/** Overloaded or rate-limited: worth retrying elsewhere or later. */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/** Nominatim's usage policy requires an identifying User-Agent; Overpass rejects spoofed browser ones. */
const DEFAULT_USER_AGENT = `query-geo-boundary/${version} (+https://github.com/tibetty/QueryGeoBoundary)`;

export interface QueryGeoBoundaryOptions {
    /**
     * `'nominatim'` (default) queries Nominatim once with `polygon_geojson`.
     * `'overpass'` looks the place up on Nominatim, then fetches the boundaries from Overpass in one query.
     */
    source?: 'nominatim' | 'overpass';
    /** Overpass endpoint(s) to try in order. Defaults to overpass-api.de, overpass.private.coffee and maps.mail.ru. */
    overpassUrl?: string | string[];
    /** User-Agent sent to both services; set it to your application's name and contact. */
    userAgent?: string;
}

/** A Nominatim search result for an OSM relation, with its boundary under `geojson`. */
export interface GeoBoundaryPlace {
    place_id: number;
    osm_type: 'relation';
    osm_id: number;
    display_name: string;
    lat: string;
    lon: string;
    boundingbox: [string, string, string, string];
    class: string;
    type: string;
    geojson?: GeoJSON;
    [key: string]: unknown;
}

/** An HTTP failure from Nominatim or Overpass. */
export interface HttpError extends Error {
    status: number;
}

async function fetchText(service: string, url: string, init: RequestInit, opts: QueryGeoBoundaryOptions): Promise<string> {
    const response = await fetch(url, { ...init, headers: { 'User-Agent': opts.userAgent || DEFAULT_USER_AGENT } });
    if (response.status !== 200) {
        const err = new Error(`${service} request failed: HTTP ${response.status} ${STATUS_CODES[response.status] || ''}`.trim()) as HttpError;
        err.status = response.status;
        throw err;
    }
    return response.text();
}

async function searchRelations(name: string, params: Record<string, string>, opts: QueryGeoBoundaryOptions): Promise<GeoBoundaryPlace[]> {
    const url = `${NOMINATIM_URL}?${new URLSearchParams({ format: 'json', q: name, ...params })}`;
    const body = await fetchText('Nominatim', url, {}, opts);
    let places: { osm_type?: string }[];
    try {
        places = JSON.parse(body);
    } catch (cause) {
        throw new Error('Nominatim returned an invalid JSON response', { cause });
    }
    return places.filter((place): place is GeoBoundaryPlace => place.osm_type === 'relation');
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Overload, rate limit, network failure or client timeout: try the next endpoint or round. */
function isRetryable(err: unknown): boolean {
    const status = (err as Partial<HttpError>).status;
    return status === undefined || RETRYABLE_STATUS.has(status);
}

/** Runs `data` on each endpoint in turn, for up to three rounds with backoff in between. */
async function overpass(data: string, opts: QueryGeoBoundaryOptions): Promise<string> {
    const urls = opts.overpassUrl === undefined ? OVERPASS_URLS : [opts.overpassUrl].flat();
    let lastError: unknown;
    for (let round = 0; round <= OVERPASS_BACKOFF_MS.length; round++) {
        if (round > 0) await sleep(OVERPASS_BACKOFF_MS[round - 1]);
        for (const url of urls) {
            try {
                return await fetchText('Overpass', url, {
                    method: 'POST',
                    body: new URLSearchParams({ data }),
                    signal: AbortSignal.timeout(OVERPASS_REQUEST_TIMEOUT_MS),
                }, opts);
            } catch (err) {
                if (!isRetryable(err)) throw err;
                lastError = err;
            }
        }
    }
    throw lastError;
}

async function queryFromOverpass(name: string, opts: QueryGeoBoundaryOptions): Promise<GeoBoundaryPlace[]> {
    const places = await searchRelations(name, {}, opts);
    if (places.length === 0) return places;
    const ids = places.map(place => place.osm_id).join(',');
    const body = await overpass(`[out:xml][timeout:${OVERPASS_QUERY_TIMEOUT_S}];rel(id:${ids});out geom;`, opts);
    const { features } = osm2geojson(body, { completeFeature: true }) as FeatureCollection;
    const geometries = new Map(features.map(feature => [feature.id, feature.geometry]));
    for (const place of places) {
        const geometry = geometries.get(`relation/${place.osm_id}`);
        if (geometry) place.geojson = geometry;
    }
    return places;
}

/**
 * Looks up `name` on OpenStreetMap and resolves to the matching relations with their boundaries.
 * Rejects with an `Error`; HTTP failures carry `status`.
 */
export function queryGeoBoundary(name: string, opts: QueryGeoBoundaryOptions = {}): Promise<GeoBoundaryPlace[]> {
    if (opts.source === 'overpass') return queryFromOverpass(name, opts);
    return searchRelations(name, { polygon_geojson: '1' }, opts);
}

export default queryGeoBoundary;
