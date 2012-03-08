// #!/usr/bin/env node

var SphinxClient = require ("../lib/sphinxapi.js"),
	assert = require('assert');

var cl = new SphinxClient();
var r = cl.AddQuery('test');
console.log(r);

