// #!/usr/bin/env node

var SphinxClient = require ("../lib/sphinxapi.js");

var cl = new SphinxClient();
//cl.SetServer('localhost', 51023);
cl.SetServer('172.16.128.183',  51023);
cl.Status(function(r) {
		console.log(r)
})

//cl.AddQuery('test');
//console.log(cl.RunQueries());

