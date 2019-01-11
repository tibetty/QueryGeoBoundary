module.exports = (name, opts) => {
	'use strict';

	const request = require('request'),
		http = require('http'),
		osm2geojson = require('osm2geojson-lite');

	// to minic accesses from a browser so as to avoid being blocked
	const headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36'};
	
	// a slower way - query from overpass
	function queryFromOverpass(name) {
		function searchForAreas(name) {
			return new Promise((resolve, reject) => {
				let options = {
					url: 'https://nominatim.openstreetmap.org/search',
					qs: {
						format: 'json',
						q: `${name}`
					},
					headers
				};
				
				request(options, (error, response, body) => {
					if (!error && response.statusCode === 200) {
						let places = JSON.parse(body);
						let result = [];
						for (let place of places)
							if (place.osm_type === 'relation') result.push(place);
						resolve(result);
					} else reject(error || http.STATUS_CODES[response.statusCode]);
				});
			});
		}
		
		function getBoundary(areaId) {
			return new Promise((resolve, reject) => {
				let options = {
					url: 'https://overpass-api.de/api/interpreter',
					method: 'post',
					form: {
						data: `area(${areaId});rel(pivot);out geom;`
					},
					headers
				};

				request(options, (error, response, body) => {
					if (!error && response.statusCode === 200) {
						try {
							resolve(osm2geojson(body));
						} catch (e) {
							reject(e);
						}
					} else reject(error || http.STATUS_CODES[response.statusCode]);
				});
			});
		}
		
		return new Promise((resolve, reject) => {
			searchForAreas(name).then(areas => {
				let promised = [];
				for (let area of areas) {
					const AREA_ID_PROTO = '3600000000';
					let areaId = `${AREA_ID_PROTO.substring(0, AREA_ID_PROTO.length - area.osm_id.length)}${area.osm_id}`;
					promised.push(getBoundary(areaId));
				}
				Promise.all(promised).then(geojsons => {
					for (let idx in areas)
						areas[idx].geojson = geojsons[idx];
					resolve(areas);
				}).catch (err => {
					reject(err);
				});
			}).catch (err => {
				reject(err);
			});
		});
	}
	
	// a much faster way - query from osm (OpenStreetMap), mostly 'coz there is only 1 internet access
	function queryFromOpenStreetMap(name) {
		return new Promise((resolve, reject) => {
			let options = {
				url: 'https://nominatim.openstreetmap.org/search',
				qs: {
					format: 'json',
					q: `${name}`,
					polygon_geojson: 1
				},
				headers
			};
			request(options, (error, response, body) => {
				if (!error && response.statusCode === 200) {
					let places = JSON.parse(body);
					let result = [];
					for (let place of places) if (place.osm_type ===  'relation') result.push(place);
					resolve(result);
				} else reject(error || http.STATUS_CODES[response.statusCode]);
			});
		});
	}
	
	if (opts && opts.source === 'overpass') return queryFromOverpass(name);
	return queryFromOpenStreetMap(name);
}