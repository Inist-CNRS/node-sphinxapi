// #!/usr/bin/env node

var SphinxClient = require ("../lib/sphinxapi.js"),
	assert = require('assert');

var r,cl = new SphinxClient();
cl.SetServer('localhost', 19312);
r = cl.AddQuery('test');
console.log(r);
r = cl.AddQuery('truc');
console.log(r);

