import { STATUS_CODES } from 'node:http';
import type { GeoJSON } from 'geojson';
import osm2geojson from 'osm2geojson-lite';
import { version } from '../package.json' with { type: 'json' };

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

/** Overpass derives an area id from a relation id by adding this offset. */
const RELATION_AREA_OFFSET = 3600000000;

/** Nominatim's usage policy requires an identifying User-Agent; Overpass rejects spoofed browser ones. */
const DEFAULT_USER_AGENT = `query-geo-boundary/${version} (+https://github.com/tibetty/QueryGeoBoundary)`;

export interface QueryGeoBoundaryOptions {
    /**
     * `'nominatim'` (default) queries Nominatim once with `polygon_geojson`.
     * `'overpass'` looks the place up on Nominatim, then fetches each boundary from Overpass.
     */
    source?: 'nominatim' | 'overpass';
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

async function queryFromOverpass(name: string, opts: QueryGeoBoundaryOptions): Promise<GeoBoundaryPlace[]> {
    const areas = await searchRelations(name, {}, opts);
    // One request at a time: Overpass grants each client only a few concurrent slots.
    for (const area of areas) {
        const areaId = RELATION_AREA_OFFSET + Number(area.osm_id);
        const body = await fetchText('Overpass', OVERPASS_URL, {
            method: 'POST',
            body: new URLSearchParams({ data: `area(${areaId});rel(pivot);out geom;` }),
        }, opts);
        area.geojson = osm2geojson(body);
    }
    return areas;
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
