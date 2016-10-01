#!/usr/bin/env node
'use strict';

var request = require('request');

module.exports = function(name, options) {
	// a slower way - query from overpass
	function _queryFromOverpass(name) {
		function _getAreas(name) {
			return new Promise((resolve, reject) => {
				let options = {
					url: 'https://nominatim.openstreetmap.org/search',
					qs: {
						format: 'json',
						q: `${name}`
					}
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
					}
				};
				
				request(options, (error, response, body) => {
					if (!error && response.statusCode === 200) {
						let _parseBoundary = function(xmlBody) {
							// parse outer/inner ways
							let outerWays = [], outerFirstMap = {}, outerLastMap = {};
							let innerWays = [], innerFirstMap = {}, innerLastMap = {};
							
							let _first = function(a) { return a[0] };
							let _last = function(a) { return a[a.length - 1] };
							
							let _addToMap = function(m, k, v) {
								let a = m[k];
								if (a) a.push(v);
								else m[k] = [v];
							};
							
							let _removeFromMap = function(m, k, v) {
								let a = m[k];
								if (a) a.splice(a.indexOf(v), 1);
							};
							
							let _getFromMap = function(m, k) {
								let a = m[k];
								if (a && a.length >= 1) return a[0];
								else return null;
							};
							
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
							
							// join outer ways to form outer polygons
							let _isClosed = function(a) { return _first(a).toString() === _last(a).toString(); }
							let outerPolygons = [], innerPolygons = [];
							let way = null;
							while (way = outerWays.pop()) {
								if (_isClosed(way)) {
									outerPolygons.push(way);
								}
								else {
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
											if (reversed) current = current.reverse();
											current = current.slice(1);
										}
									}
									if (_isClosed(line))
										outerPolygons.push(line);
								}
							}
							
							// join inner ways to form outer polygons
							while (way = innerWays.pop()) {
								if (_isClosed(way)) {
									innerPolygons.push(way);
								}
								else {
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
											if (reversed) current = current.reverse();
											current = current.slice(1);
										}
									}
									if (_isClosed(line))
										innerPolygons.push(line);
								}
							}
							
							// link inner polygons to outer containers
							let _ptInsidePolygon = function(pt, polygon) {
								const lngIdx = 0, latIdx = 1;
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
							
							let ipoly = null;
							while (ipoly = innerPolygons.pop()) {
								for (let idx in outerPolygons) {
									if (_ptInsidePolygon(_first(ipoly), outerPolygons[idx])) {
										compositPolyons[idx].push(ipoly);
										break;
									}
								}
							}
							
							// construct return value (geojson polyon or multipolygon
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
							resolve(_parseBoundary(body));
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
	
	// a much faster way - query from osm (OpenStreetMap)
	function _queryFromOpenStreetMap(name) {
		return new Promise((resolve, reject) => {
			let options = {
				url: 'https://nominatim.openstreetmap.org/search',
				qs: {
					format: 'json',
					q: `${name}`,
					polygon_geojson: 1
				}
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
	else return _queryFromOpenStreetMap(name);
}