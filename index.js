﻿module.exports = (name, options) => {
	'use strict';

	const request = require('request'),
		http = require('http');

	// to minic accesses from a browser so as to avoid being blocked
	const headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.112 Safari/537.36'};
	
	// a slower way - query from overpass
	function _queryFromOverpass(name) {
		function _getAreas(name) {
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
		
		function _getBoundary(areaId) {
			return new Promise((resolve, reject) => {
				let options = {
					url: 'http://overpass-api.de/api/interpreter',
					method: 'post',
					form: {
						data: `area(${areaId});rel(pivot);out geom;`
					},
					headers
				};

				request(options, (error, response, body) => {
					if (!error && response.statusCode === 200) {
						function _parseBoundary(xmlBody) {
							// parse outer/inner ways
							let outerWays = [], outerFirstMap = {}, outerLastMap = {};
							let innerWays = [], innerFirstMap = {}, innerLastMap = {};
							
							const _first = a => a[0];
							const _last = a => a[a.length - 1];
							
							function _addToMap(m, k, v) {
								let a = m[k];
								if (a) a.push(v);
								else m[k] = [v];
							}
							
							function _removeFromMap(m, k, v) {
								let a = m[k];
								if (a) a.splice(a.indexOf(v), 1);
							}
							
							function _getFromMap(m, k) {
								let a = m[k];
								if (a && a.length >= 1) return a[0];
								return null;
							}
							
							let outerSegments = xmlBody.split(/(<member type="way" ref="\d+" role="outer">)/);
							for (let i = 1; i < outerSegments.length; i += 2) {
								let idx = outerSegments[i + 1].indexOf('</member>');
								let outerContent = outerSegments[i + 1].substring(0, idx);
								let leftOver = outerSegments[i + 1].substring(idx + '</member>'.length);
								let way = [];
								let ndRegEx = /<nd lat="([\d\.]+)" lon="([\d\.]+)"\/>/g;
								let match = null;
								while (match = ndRegEx.exec(outerContent))
									way.push([parseFloat(match[2]), parseFloat(match[1])]);
								outerWays.push(way);
								_addToMap(outerFirstMap, _first(way).toString(), way);
								_addToMap(outerLastMap, _last(way).toString(), way);
								let innerSegments = leftOver.split(/(<member type="way" ref="\d+" role="inner">)/);
								if (innerSegments.length > 1) {
									for (let j = 1; j < innerSegments.length; j += 2) {
										let innerContent = innerSegments[j + 1].substring(0, innerSegments[j + 1].indexOf('</member>'));
										let way = [];
										while (match = ndRegEx.exec(innerContent))
											way.push([parseFloat(match[2]), parseFloat(match[1])]);
										innerWays.push(way);
										_addToMap(innerFirstMap, _first(way).toString(), way);
										_addToMap(innerLastMap, _last(way).toString(), way);
									}
								}
							}
							
							const _isRing = a => _first(a).toString() === _last(a).toString();
							
							function _isClockwise(a, xIdx, yIdx) {
								xIdx = xIdx || 0, yIdx = yIdx || 1;
								let m = a.reduce((last, v, current) => a[last][0] > v[0] ? last : current, 0);
								let l = m <= 0? a.length - 1 : m - 1, r = m >= a.length - 1? 0 : m + 1;
								let xa = a[l][xIdx], xb = a[m][xIdx], xc = a[r][xIdx];
								let ya = a[l][yIdx], yb = a[m][yIdx], yc = a[r][yIdx];
								let det = (xb - xa) * (yc - ya) - (xc - xa) * (yb - ya);
								return det < 0;
							}

							// join outer ways to form outer polygons
							let outerPolygons = [], innerPolygons = [];
							let way = null;
							while (way = outerWays.pop()) {
								if (_isRing(way)) {
									if (_isClockwise(way)) way.reverse();
									outerPolygons.push(way);
								} else {
									let line = [];
									let current = way;
									let reversed = false;
									_removeFromMap(outerFirstMap, _first(current).toString(), current);
									_removeFromMap(outerLastMap, _last(current).toString(), current);
									while (current) {
										line = line.concat(current);
										let key = _last(line).toString();
										reversed = false;
										current = _getFromMap(outerFirstMap, key);
										if (!current) {
											current = _getFromMap(outerLastMap, key);
											reversed = true;
										}
										if (current) {
											outerWays.splice(outerWays.indexOf(current), 1);
											_removeFromMap(outerFirstMap, _first(current).toString(), current);
											_removeFromMap(outerLastMap, _last(current).toString(), current);
											if (reversed) current.reverse();
											current = current.slice(1);
										}
									}
									// points of an outerpolygon should be organized counterclockwise
									if (_isRing(line)) {
										if (_isClockwise(line)) line.reverse();
										outerPolygons.push(line);
									}
								}
							}
							
							
							// join inner ways to form outer polygons
							while (way = innerWays.pop()) {
								if (_isRing(way)) {
									if (!_isClockwise(way)) way.reverse();
									innerPolygons.push(way);
								} else {
									let line = [];
									let current = way;
									let reversed = false;
									_removeFromMap(innerFirstMap, _first(current).toString(), current);
									_removeFromMap(innerLastMap, _last(current).toString(), current);
									while (current) {
										line = line.concat(current);
										let key = _last(line).toString();
										reversed = false;
										current = _getFromMap(innerFirstMap, key);
										if (!current) {
											current = _getFromMap(innerLastMap, key);
											reversed = true;
										}
										if (current) {
											innerWays.splice(outerWays.indexOf(current), 1);
											_removeFromMap(innerFirstMap, _first(current).toString(), current);
											_removeFromMap(innerLastMap, _last(current).toString(), current);
											if (reversed) current.reverse();
											current = current.slice(1);
										}
									}
									// points of an innerpolygon should be organized clockwise
									if (_isRing(line)) {
										if (!_isClockwise(line)) line.reverse();
										innerPolygons.push(line);
									}
								}
							}
							
							// link inner polygons to outer containers
							function _ptInsidePolygon(pt, polygon, lngIdx, latIdx) {
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
									if (_ptInsidePolygon(_first(ipg), outerPolygons[idx])) {
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
							resolve(_parseBoundary(body));
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
			_getAreas(name).then(areas => {
				let promised = [];
				for (let area of areas) {
					const AREA_ID_PROTO = '3600000000';
					let areaId = `${AREA_ID_PROTO.substring(0, AREA_ID_PROTO.length - area.osm_id.length)}${area.osm_id}`;
					promised.push(_getBoundary(areaId));
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
	function _queryFromOpenStreetMap(name) {
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
	
	if (options && options.source === 'overpass') return _queryFromOverpass(name);
	return _queryFromOpenStreetMap(name);
}