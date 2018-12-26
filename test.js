const queryGeoBoundary = require('./index.js');
queryGeoBoundary('東京都', {source: 'overpass'}).then(boundaries => {
	console.log(JSON.stringify(boundaries));
}).catch(err => {
	console.log(err);
});
