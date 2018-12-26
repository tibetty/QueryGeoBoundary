module.exports = (name, opts) => {
	'use strict';

	const request = require('request'),
		http = require('http');

	// to minic accesses from a browser so as to avoid being blocked
	const headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.112 Safari/537.36'};
	
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
						function xmlToGeojson(xmlBody) {
							// parse outer/inner ways
							let outerWays = [], outerFirstMap = {}, outerLastMap = {};
							let innerWays = [], innerFirstMap = {}, innerLastMap = {};
							
							const first = a => a[0];
							const last = a => a[a.length - 1];
							
							function addToMap(m, k, v) {
								let a = m[k];
								if (a) a.push(v);
								else m[k] = [v];
							}
							
							function removeFromMap(m, k, v) {
								let a = m[k];
								if (a) a.splice(a.indexOf(v), 1);
							}
							
							function getFromMap(m, k) {
								let a = m[k];
								if (a && a.length >= 1) return a[0];
								return null;
							}

							const coordsToKey = (coords) => coords.join(',');
							
							let outerSegments = xmlBody.split(/(<member type="way" ref="\d+" role="outer">)/);
							for (let i = 1; i < outerSegments.length; i += 2) {
								let idx = outerSegments[i + 1].indexOf('</member>');
								let outerContent = outerSegments[i + 1].substring(0, idx);
								let leftOver = outerSegments[i + 1].substring(idx + '</member>'.length);
								let way = [];
								let ndRegEx = /<nd lat="([\d\.]+)" lon="([\d\.]+)"\/>/g;
								let match = null;
								while (match = ndRegEx.exec(outerContent))
									way.push([match[2], match[1]]);
								outerWays.push(way);
								addToMap(outerFirstMap, coordsToKey(first(way)), way);
								addToMap(outerLastMap, coordsToKey(last(way)), way);
								let innerSegments = leftOver.split(/(<member type="way" ref="\d+" role="inner">)/);
								if (innerSegments.length > 1) {
									for (let j = 1; j < innerSegments.length; j += 2) {
										let innerContent = innerSegments[j + 1].substring(0, innerSegments[j + 1].indexOf('</member>'));
										let way = [];
										while (match = ndRegEx.exec(innerContent))
											way.push([match[2], match[1]]);
										innerWays.push(way);
										addToMap(innerFirstMap, coordsToKey(first(way)), way);
										addToMap(innerLastMap, coordsToKey(last(way)), way);
									}
								}
							}
							
							const isRing = a => coordsToKey(first(a)) === coordsToKey(last(a));
							
							function isClockwise(a, xIdx, yIdx) {
								xIdx = xIdx || 0, yIdx = yIdx || 1;
								let m = a.reduce((last, v, current) => a[last][0] > v[0] ? last : current, 0);
								let l = m <= 0? a.length - 1 : m - 1, r = m >= a.length - 1? 0 : m + 1;
								let xa = a[l][xIdx], xb = a[m][xIdx], xc = a[r][xIdx];
								let ya = a[l][yIdx], yb = a[m][yIdx], yc = a[r][yIdx];
								let det = (xb - xa) * (yc - ya) - (xc - xa) * (yb - ya);
								return det < 0;
							}

							const strToFloat = el => el instanceof Array? el.map(strToFloat) : parseFloat(el);

							// join outer ways to form outer polygons
							let outerPolygons = [], innerPolygons = [];
							let way = null;
							while (way = outerWays.pop()) {
								if (isRing(way)) {
									way = strToFloat(way);
									if (isClockwise(way)) way.reverse();
									outerPolygons.push(way);
								} else {
									let line = [];
									let current = way;
									let reversed = false;
									removeFromMap(outerFirstMap, coordsToKey(first(current)), current);
									removeFromMap(outerLastMap, coordsToKey(last(current)), current);
									while (current) {
										line = line.concat(current);
										let key = coordsToKey(last(line));
										reversed = false;

										current = getFromMap(outerFirstMap, key);										
										if (!current) {
											current = getFromMap(outerLastMap, key);
											reversed = true;
										}
										
										if (current) {
											outerWays.splice(outerWays.indexOf(current), 1);
											removeFromMap(outerFirstMap, coordsToKey(first(current)), current);
											removeFromMap(outerLastMap, coordsToKey(last(current)), current);
											if (reversed) current.reverse();
											current = current.slice(1);
										}
									}
									// points of an outerpolygon should be organized counterclockwise
									if (isRing(line)) {
										line = strToFloat(line);
										if (isClockwise(line)) line.reverse();
										outerPolygons.push(line);
									}
								}
							}
							
							// join inner ways to form outer polygons
							while (way = innerWays.pop()) {
								if (isRing(way)) {
									way = strToFloat(way);
									if (!isClockwise(way)) way.reverse();
									innerPolygons.push(way);
								} else {
									let line = [];
									let current = way;
									let reversed = false;
									removeFromMap(innerFirstMap, coordsToKey(first(current)), current);
									removeFromMap(innerLastMap, coordsToKey(last(current)), current);
									while (current) {
										line = line.concat(current);
										let key = coordsToKey(last(line));
										reversed = false;

										current = getFromMap(innerFirstMap, key);
										if (!current) {
											current = getFromMap(innerLastMap, key);
											reversed = true;
										}

										if (current) {
											innerWays.splice(innerWays.indexOf(current), 1);
											removeFromMap(innerFirstMap, coordsToKey(first(current)), current);
											removeFromMap(innerLastMap, coordsToKey((current)).toString(), current);
											if (reversed) current.reverse();
											current = current.slice(1);
										}
									}
									// points of an innerpolygon should be organized clockwise
									if (isRing(line)) {
										line = strToFloat(line);
										if (!isClockwise(line)) line.reverse();
										innerPolygons.push(line);
									}
								}
							}
							
							// link inner polygons to outer containers
							function ptInsidePolygon(pt, polygon, lngIdx, latIdx) {
								lngIdx = lngIdx || 0, latIdx = latIdx || 1;
								let result = false;
								for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
									if ((polygon[i][lngIdx] <= pt[lngIdx] && pt[lngIdx] < polygon[j][lngIdx] ||
										polygon[j][lngIdx] <= pt[lngIdx] && pt[lngIdx] < polygon[i][lngIdx]) &&
										pt[latIdx] < (polygon[j][latIdx] - polygon[i][latIdx]) * (pt[lngIdx] - polygon[i][lngIdx]) / (polygon[j][lngIdx] - polygon[i][lngIdx]) + polygon[i][latIdx])
										result = !result;
								}
								return result;
							}
							
							let compositPolyons = [];
							for (let idx in outerPolygons) {
								compositPolyons[idx] = [];
								compositPolyons[idx].push(outerPolygons[idx]);
							}
							
							let ipg = null;
							while (ipg = innerPolygons.pop()) {
								for (let idx in outerPolygons) {
									if (ptInsidePolygon(first(ipg), outerPolygons[idx])) {
										compositPolyons[idx].push(ipg);
										break;
									}
								}
							}
							
							// construct return value (geojson polyon or multipolygon)
							let geom = {
								type: 'MultiPolygon',
								coordinates: compositPolyons
							};
							
							if (compositPolyons.length === 1) geom = {
								type: 'Polygon',
								coordinates: compositPolyons[0]
							};
							
							return geom;
						};
						
						body = body.replace(/^\s+|\s+$/mg, '').replace(/[\n\r]/g, '');
						try {
							/*
							let stime = new Date().getTime();
							console.log(`_getBondary begins...`);
							*/
							resolve(xmlToGeojson(body));
							/*
							let etime = new Date().getTime();
							console.log(`---${etime - stime}ms cost by parseBoundary---`);
							*/
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