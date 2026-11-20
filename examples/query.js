const queryGeoBoundary = require('..');
queryGeoBoundary('諸城', {source: 'overpass'}).then(boundaries => {
	console.log(JSON.stringify(boundaries));
}).catch(err => {
	console.log(err);
});
