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
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/vert.png) GetLastWarning() 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/vert.png) SetServer (host, port) 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/vert.png) SetConnectTimeout (timeout) 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/vert.png) SetLimits (offset, limit, maxmatches, cutoff) 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/vert.png) SetMaxQueryTime (maxquerytime) 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/vert.png) SetMatchMode (mode) 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/vert.png) SetRankingMode (ranker, rankexpr) 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/vert.png) SetSortMode (mode, clause) 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/vert.png) SetWeights (weights) 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/vert.png) SetFieldWeights (weights) 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/vert.png) SetIndexWeights (weights) 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/vert.png) SetIDRange (minid, maxid) 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/vert.png) SetFilter (attribute, values, exclude) 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/vert.png) SetGeoAnchor (attrlat, attrlong, latitude, longitude) 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/vert.png) SetGroupBy (attribute, func, groupsort ) 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/vert.png) SetGroupDistinct (attribute) 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/vert.png) SetRetries (count, delay) 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/vert.png) SetOverride (name, type, values) 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/vert.png) SetSelect (select) 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/vert.png) ResetOverrides () 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/vert.png) ResetFilters () 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/vert.png) ResetGroupBy () 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/orange.png) Query (query, index, comment, fn) 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/orange.png) AddQuery (query, index, comment) 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/orange.png) RunQueries (fn) 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/rouge.png) BuildExcerpts (docs, index, words, opts) 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/rouge.png) UpdateAttributes (index, attrs, values, mva) 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/rouge.png) BuildKeywords (query, index, hits ) 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/vert.png) Status (fn) 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/rouge.png) Open () 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/rouge.png) Close () 
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/rouge.png) EscapeString (string)
### ![Porting Status](https://github.com/lindory-project/node-sphinxapi/raw/master/vert.png) FlushAttributes () 

# Also

* https://github.com/kurokikaze/limestone

# License

[MIT/X11](./LICENSE)

