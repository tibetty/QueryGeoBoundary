// const util = require('util');
const queryGeoBoundary = require('./index.js');
queryGeoBoundary('莘县', {source: 'overpass'}).then(boundaries => {
	console.log(JSON.stringify(boundaries[0].geojson));
}).catch(err => {
	console.log(err);
});
