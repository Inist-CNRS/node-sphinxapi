// #!/usr/bin/env node

var SphinxClient = require ("../lib/sphinxapi.js"),
	assert = require('assert');

var cl = new SphinxClient();
//cl.SetServer('localhost', 51023);
//cl.SetServer('172.16.128.183',  51023);
cl.Status(function(err) {
		assert.ifError(err);
		console.log('Status is OK');
})

cl.AddQuery('test');
//console.log(cl.RunQueries());

