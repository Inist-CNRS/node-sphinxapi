#!/usr/bin/env node

var SphinxClient = require ("../lib/sphinxapi.js"),
	util = require('util'),
	assert = require('assert');

var cl = new SphinxClient();
cl.SetServer('localhost', 19312);
cl.Status(function(err, result) {
		assert.ifError(err);
		console.log(util.inspect(result, false, null, true));
})
