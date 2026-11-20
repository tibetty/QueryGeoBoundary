'use strict';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OVERPASS = 'https://overpass-api.de/api/interpreter';

// Replaces globalThis.fetch for one test. `routes` maps a URL prefix to
// (url, init) => { status, body }; every call is recorded and returned.
function stubFetch(t, routes) {
	const calls = [];
	const original = globalThis.fetch;
	globalThis.fetch = async (input, init = {}) => {
		const url = String(input);
		calls.push({ url, init });
		const prefix = Object.keys(routes).find(p => url.startsWith(p));
		if (!prefix) throw new Error(`unexpected fetch: ${url}`);
		const { status = 200, body = '' } = await routes[prefix](url, init);
		return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
	};
	t.after(() => { globalThis.fetch = original; });
	return calls;
}

// A Nominatim hit; `osm_id` is numeric, as Nominatim returns it today.
function place(osmId, extra = {}) {
	return { place_id: osmId + 1, osm_type: 'relation', osm_id: osmId, display_name: `place ${osmId}`, ...extra };
}

// An Overpass answer holding one closed boundary relation.
function overpassXml(relId) {
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

module.exports = { stubFetch, place, overpassXml, NOMINATIM, OVERPASS };
