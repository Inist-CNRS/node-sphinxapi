// #!/usr/bin/env node

var SphinxClient = require ("../lib/sphinxapi.js"),
	assert = require('assert');

var cl = new SphinxClient();
cl.Query('test', function(err, res) { 
		console.log(err, res);
});

