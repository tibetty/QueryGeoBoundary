// const util = require('util');
const queryGeoBoundary = require('./index.js');
queryGeoBoundary('諸城', {source: 'overpass'}).then(boundaries => {
	console.log(JSON.stringify(boundaries));
}).catch(err => {
	console.log(err);
});
