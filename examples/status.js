// #!/usr/bin/env node

var SphinxClient = require ("../lib/sphinxapi.js"),
	assert = require('assert');

var cl = new SphinxClient();
cl.Status(function(err, result) {
		assert.ifError(err);
		console.log(result);
})
