# Sphinx Search Client for NodeJS

It's native javascript implementation of the standard Sphinx API. The API is totaly similar with the others API clients 
implementation. It's also respects NodeJS code convention.

This implementation is based on the Python Official Sphinx Client. 

# Installation

coming soon ...


# Examples

## Status

```javascript
var SphinxClient = require ("sphinxapi"),
	util = require('util'),
	assert = require('assert');

var cl = new SphinxClient();
cl.SetServer('localhost', 19312);
cl.Status(function(err, result) {
		assert.ifError(err);
		console.log(util.inspect(result, false, null, true));
})
```

## Query

```javascript
var SphinxClient = require ("sphinxapi"),
	util = require('util'),
	assert = require('assert');

var cl = new SphinxClient();
cl.SetServer('localhost', 19312);
cl.Query('test', function(err, result) { 
		assert.ifError(err);
		console.log(util.inspect(result, false, null, true));
});
```

# API Documentation

from the official documentation : http://sphinxsearch.com/docs/current.html#api-reference

### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/vert.png) GetLastError() 
### ![Porting Status](./blob/master/vert.png?raw=true) GetLastWarning() 
### ![Porting Status](./blob/master/vert.png?raw=true) SetServer (host, port) 
### ![Porting Status](./blob/master/vert.png?raw=true) SetConnectTimeout (timeout) 
### ![Porting Status](./blob/master/vert.png?raw=true) SetLimits (offset, limit, maxmatches, cutoff) 
### ![Porting Status](./blob/master/vert.png?raw=true) SetMaxQueryTime (maxquerytime) 
### ![Porting Status](./blob/master/vert.png?raw=true) SetMatchMode (mode) 
### ![Porting Status](./blob/master/vert.png?raw=true) SetRankingMode (ranker, rankexpr) 
### ![Porting Status](./blob/master/vert.png?raw=true) SetSortMode (mode, clause) 
### ![Porting Status](./blob/master/vert.png?raw=true) SetWeights (weights) 
### ![Porting Status](./blob/master/vert.png?raw=true) SetFieldWeights (weights) 
### ![Porting Status](./blob/master/vert.png?raw=true) SetIndexWeights (weights) 
### ![Porting Status](./blob/master/vert.png?raw=true) SetIDRange (minid, maxid) 
### ![Porting Status](./blob/master/vert.png?raw=true) SetFilter (attribute, values, exclude) 
### ![Porting Status](./blob/master/vert.png?raw=true) SetGeoAnchor (attrlat, attrlong, latitude, longitude) 
### ![Porting Status](./blob/master/vert.png?raw=true) SetGroupBy (attribute, func, groupsort ) 
### ![Porting Status](./blob/master/vert.png?raw=true) SetGroupDistinct (attribute) 
### ![Porting Status](./blob/master/vert.png?raw=true) SetRetries (count, delay) 
### ![Porting Status](./blob/master/vert.png?raw=true) SetOverride (name, type, values) 
### ![Porting Status](./blob/master/vert.png?raw=true) SetSelect (select) 
### ![Porting Status](./blob/master/vert.png?raw=true) ResetOverrides () 
### ![Porting Status](./blob/master/vert.png?raw=true) ResetFilters () 
### ![Porting Status](./blob/master/vert.png?raw=true) ResetGroupBy () 
### ![Porting Status](./blob/master/orange.png?raw=true) Query (query, index, comment, fn) 
### ![Porting Status](./blob/master/orange.png?raw=true) AddQuery (query, index, comment) 
### ![Porting Status](./blob/master/orange.png?raw=true) RunQueries (fn) 
### ![Porting Status](./blob/master/rouge.png?raw=true) BuildExcerpts (docs, index, words, opts) 
### ![Porting Status](./blob/master/rouge.png?raw=true) UpdateAttributes (index, attrs, values, mva) 
### ![Porting Status](./blob/master/rouge.png?raw=true) BuildKeywords (query, index, hits ) 
### ![Porting Status](./blob/master/vert.png?raw=true) Status (fn) 
### ![Porting Status](./blob/master/rouge.png?raw=true) Open () 
### ![Porting Status](./blob/master/rouge.png?raw=true) Close () 
### ![Porting Status](./blob/master/rouge.png?raw=true) EscapeString (string)
### ![Porting Status](./blob/master/vert.png?raw=true) FlushAttributes () 


# Also

* https://github.com/kurokikaze/limestone

# License

[MIT/X11](./LICENSE)

