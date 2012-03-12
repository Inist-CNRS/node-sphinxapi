// #!/usr/bin/env node

var SphinxClient = require ("../lib/sphinxapi.js"),
	assert = require('assert');

var cl = new SphinxClient();
var r = cl.AddQuery('test');
cl.RunQueries(function(err, result) {
		console.log(result);
})

