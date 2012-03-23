// #!/usr/bin/env node

var SphinxClient = require ("../lib/sphinxapi.js"),
	assert = require('assert');

var cl = new SphinxClient();
cl.SetServer('localhost', 19312);
var r = cl.AddQuery('test');
cl.RunQueries(function(err, result) {
		console.log(result);
})

