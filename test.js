const queryGeoBoundary = require('./index.js');
queryGeoBoundary('河北省', {source: 'overpass'}).then(boundaries => {
	console.log(JSON.stringify(boundaries));
}).catch(err => {
	console.log(err);
});
