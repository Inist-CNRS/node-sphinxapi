'use strict'
/*!
* sphinxapi
* Copyright(c) 2012 Nicolas Thouvenin <nthouvenin@gmail.com>
* MIT Licensed
*/

/**
* Module dependencies.
*/
var net   = require('net'),
	bp    = require('bufferpack'),
	Put   = require('put'),
	assert = require('assert'),
	util = require('util'),
	debug = require('debug')('SphinxClient'),
	server_say = require('debug')('server'),
	client_say = require('debug')('client')
;

/**
* Useful function
*
* @api private
*/

function packUInt64(number) {
  return Put().word64be(number).buffer()
}

function packInt64(number) {
  return Put().word64be(number).buffer()
}

function unpackUInt64(buffer) {
  var high = buffer.readUInt32BE(0)
  var low = buffer.readUInt32BE(4)
  return high*4294967296+low
}

function unpackInt64(buffer) {
  var high = buffer.readInt32BE(0)
  var low = buffer.readInt32BE(4)
  return low
}

function ConcatBuffer(a, b) {
	var t = new Buffer(a.length + b.length)
	a.copy(t, 0, 0)
	b.copy(t, a.length, 0)
	return t
}
function ReduceBuffer(a, b) {
	return ConcatBuffer(a, Buffer.isBuffer(b) ? b : new Buffer(b));
}

function forEach(o, fn) {
	if (Array.isArray(o)) {
		return o.forEach(fn);
	}
	else {
		for (var key in o) {
			if (o.hasOwnProperty(key)) {
				fn(o[key], key)
			}
		}
	}
}
function len (o){
	if (Array.isArray(o)) {
		return o.length;
	}
	else if (typeof o == 'string') {
		return Buffer.byteLength(o)
	}
	else {
		var k, l = 0;
		for(k in o) {
			l += Number( o.hasOwnProperty(k) );
		}
		return l;
	}
}
function unpack(a, b) {
	return bp.unpack(a, b);
}
function pack(a, b) {
	return bp.pack(a, b);
}

/**
* SphinxClient Object
*
* @api public
*/
function SphinxClient() {
	if (!(this instanceof SphinxClient)) {
		return new SphinxClient()
	}

	this._host			= 'localhost'					// searchd host (default is "localhost")
	this._port			= 9312							// searchd port (default is 9312)
	this._path			= null							// searchd unix-domain socket path
	this._socket		= null
	this._offset		= 0								// how much records to seek from result-set start (default is 0)
	this._limit			= 20							// how much records to return from result-set starting at offset (default is 20)
	this._mode			= SphinxClient.SPH_MATCH_ALL			// query matching mode (default is SPH_MATCH_ALL)
	this._weights		= []							// per-field weights (default is 1 for all fields)
	this._sort			= SphinxClient.SPH_SORT_RELEVANCE		// match sorting mode (default is SPH_SORT_RELEVANCE)
	this._sortby		= ''							// attribute to sort by (defualt is "")
	this._min_id		= 0								// min ID to match (default is 0)
	this._max_id		= 0								// max ID to match (default is UINT_MAX)
	this._filters		= []							// search filters
	this._groupby		= ''							// group-by attribute name
	this._groupfunc		= SphinxClient.SPH_GROUPBY_DAY // group-by function (to pre-process group-by attribute value with)
	this._groupsort		= '@group desc'					// group-by sorting clause (to sort groups in result set with)
	this._groupdistinct	= ''							// group-by count-distinct attribute
	this._maxmatches	= 1000							// max matches to retrieve
	this._cutoff		= 0								// cutoff to stop searching at
	this._retrycount	= 0								// distributed retry count
	this._retrydelay	= 0								// distributed retry delay
	this._anchor		= {}							// geographical anchor point
	this._indexweights	= {}							// per-index weights
	this._ranker		= SphinxClient.SPH_RANK_PROXIMITY_BM25  // ranking mode
	this._rankexpr		= ''							// ranking expression for SPH_RANK_EXPR
	this._maxquerytime	= 0								// max query time, milliseconds (default is 0, do not limit)
	this._timeout		= 1.0							// connection timeout
	this._fieldweights	= {}							// per-field-name weights
	this._overrides		= {}							// per-query attribute values overrides
	this._select		= '*'							// select-list (attributes or expressions, with optional aliases)

	this._error			= ''							// last error message
	this._warning		= ''							// last warning message
	this._reqs			= []							// requests array for multi-query
};
/**
* Sets and sends request packet to searchd server.
*
* @api private
*/
SphinxClient.prototype._SendRequest = function (client_ver, request, fn) {
  var self = this
  var client = false
  if (self._path) {
    client = net.connect(self._path)
    debug('Connecting to ' + self._path)
	} else if(self._host && self._port) {
	  debug('Connecting to ' + self._host + ':' + self._port)
    client = net.connect(self._port, self._host)
  }
	client.on('connect', function () {
			client_say('connected')
	});
	client.once('data', function (chunk) {
			chunk.slice(0, 4)

			var response = unpack('>L', chunk)
			server_say('>L', response)
			if (!Array.isArray(response)) {
				fn(new Error('connection to ' + self._host + ':' + self._port + ' failed'))
			} else if (Array.isArray(response) && response[0] < 1) {
				fn(new Error('expected searchd protocol version, got ' + response[0]))
			}
			else {
				client_say('received version', client_ver);
			}
			var content, state, version, length;
			client.on('data', function (chunk) {
					if (content === null || content === undefined) {
						client_say('received the response');
						response = unpack('>2HL', chunk)
						server_say('>2HL', response)
						state   = response[0]
						version = response[1]
						length  = response[2]
						content = chunk.slice(8)
						client_say('processing the response #1', state, version, length)
					}
					else {
						client_say('received following the response ')
						content = ConcatBuffer(content, chunk)
					}
					if (content.length >= length) {
						var err = null
						client_say('processing the response #2', state, version);

						if (state == SphinxClient.SEARCHD_WARNING) {
							var wend = 4 + unpack('>L', content)
							warning = content.slice(4, wend);
							// TODO do something with the warning !!!
						}
						else if (state == SphinxClient.SEARCHD_ERROR) {
							err = new Error('searchd error: ' + content.slice(4).toString())
							content = null;
						}
						else if (state == SphinxClient.SEARCHD_RETRY) {
							err = new Error('temporary searchd error: ' + content.slice(4).toString())
							content = null;
						}
						else if (state != SphinxClient.SEARCHD_OK) {
							err = new Error('unknown status code ' + state)
							content = null;
						}

						if (version < client_ver) {
							self._warning = util.format('searchd command v.%d.%d older than client\'s v.%d.%d, some options might not work',
								version>>8, version&0xff, client_ver>>8, client_ver&0xff)
							// TODO do something with the warning !!!
						}

						client.end()
						fn(err, content)
					}
        }
      );
			client_say('sending a request', request.toString());
//      process.stdout.write(request.toString('hex')+'\n')
			client.write(request);
    }
  );
	client.on('end', function () {
			client_say('disconnected');
    }
  );
	client.on('error', function (err) {
			fn(new Error('searchd connexion error'))
    }
  );
	client.write(pack('>L', 1))
};

SphinxClient.prototype.GetLastError = function () {
  var self = this
	return self._error
};
SphinxClient.prototype.GetLastWarning = function () {
  var self = this
	return self._warning
};
/**
* Set searchd server host and port or unix socket.
*
* @api public
*/
SphinxClient.prototype.SetServer = function (host, port) {
  var self = this
  if (arguments.length == 1) {
    assert.equal(typeof host, 'string')  
    self._path = host;
    return
  }
	assert.equal(typeof host, 'string')
	assert.equal(typeof port, 'number')
	self._host = host;
	self._port = port;
};
SphinxClient.prototype.SetConnectTimeout = function (timeout ) {
  var self = this
	assert.equal(typeof timeout, 'number')
	self._timeout = Math.max(0.001, timeout);
};
SphinxClient.prototype.SetLimits = function (offset, limit, maxmatches, cutoff) {
  var self = this
	assert.equal(typeof offset, 'number')
	assert.equal(typeof limit, 'number')
	assert(0 <= offset < 16777216)
	assert(0 <= limit < 16777216)
	if (maxmatches === undefined) {
		maxmatches = 0
	}
	if (cutoff === undefined) {
		cutoff = 0
	}
	assert(maxmatches >= 0)
	self._offset = offset
	self._limit = limit
	if (maxmatches > 0) {
		self._maxmatches = maxmatches
	}
	if (cutoff >= 0) {
		self._cutoff = cutoff
	}
};
SphinxClient.prototype.SetMaxQueryTime = function (maxquerytime) {
  var self = this
	assert.equal(typeof maxquerytime, 'number')
	assert(maxquerytime > 0)
	self._maxquerytime = maxquerytime
};
SphinxClient.prototype.SetMatchMode = function (mode) {
  var self = this
	var modes = [SphinxClient.SPH_MATCH_ALL, SphinxClient.SPH_MATCH_ANY, SphinxClient.SPH_MATCH_PHRASE, SphinxClient.SPH_MATCH_BOOLEAN, SphinxClient.SPH_MATCH_EXTENDED, SphinxClient.SPH_MATCH_FULLSCAN, SphinxClient.SPH_MATCH_EXTENDED2]
	assert(modes.some(function (x) { return (x === mode) }))
	self._mode = mode
};
SphinxClient.prototype.SetRankingMode = function (ranker, rankexpr) {
  var self = this
  if (rankexpr === undefined) {
    rankexpr = ''
  }
	assert(0 <= ranker && ranker < SphinxClient.SPH_RANK_TOTAL)
	self._ranker = ranker
	self._rankexpr = rankexpr
};
SphinxClient.prototype.SetSortMode = function (mode, clause) {
  var self = this
  var modes = [SphinxClient.SPH_SORT_RELEVANCE, SphinxClient.SPH_SORT_ATTR_DESC, SphinxClient.SPH_SORT_ATTR_ASC, SphinxClient.SPH_SORT_TIME_SEGMENTS, SphinxClient.SPH_SORT_EXTENDED, SphinxClient.SPH_SORT_EXPR]
  if (clause === undefined) {
    clause = ''
  }
  assert(modes.some(function (x) { return (x === mode) }))
	assert.equal(typeof clause, 'string')
  self._sort = mode
  self._sortby = clause
};
SphinxClient.prototype.SetWeights = function (weights) {
  var self = this
	assert(Array.isArray(weights))
	forEach(weights, function (item, index) {
			assert.equal(typeof item, 'number')
	})
	self._weights = weights
};
SphinxClient.prototype.SetFieldWeights = function (weights) {
  var self = this
	assert.equal(typeof weights, 'object')
	forEach(weights, function (item, index) {
			assert.equal(typeof item, 'number')
	})
	self._fieldweights = weights
};
SphinxClient.prototype.SetIndexWeights = function (weights) {
  var self = this
	assert.equal(typeof weights, 'object')
	forEach(weights, function (item, index) {
			assert.equal(typeof item, 'number')
	})
	self._indexweights = weights
};
SphinxClient.prototype.SetIDRange = function (minid, maxid) {
  var self = this
	assert.equal(typeof minid, 'number')
	assert.equal(typeof maxid, 'number')
	assert(minid <= maxid)
	self._min_id = minid
	self._max_id = maxid
};
SphinxClient.prototype.SetFilter = function (attribute, values, exclude) {
  var self = this
  if (exclude === undefined) {
    exclude = 0
  }
	assert.equal(typeof attribute, 'string')
	forEach(values, function (item, index) {
			assert.equal(typeof item, 'number')
	})
	self._filters.push({
			'type': SphinxClient.SPH_FILTER_VALUES,
			'attr': attribute,
			'exclude': exclude,
			'values': values
		})
  };
SphinxClient.prototype.SetFilterString = function (attribute, value, exclude) {
  var self = this
  if (exclude === undefined) {
    exclude = 0
  }
	assert.equal(typeof attribute, 'string')
	assert.equal(typeof value, 'string')
	self._filters.push({
			'type': SphinxClient.SPH_FILTER_STRING,
			'attr': attribute,
			'exclude': exclude,
			'value': value
		})
  };
SphinxClient.prototype.SetFilterRange = function (attribute, min_, max_, exclude) {
    var self = this
    if (exclude === undefined) {
      exclude = 0
    }
    assert.equal(typeof attribute, 'string')
    assert.equal(typeof min_, 'number')
    assert.equal(typeof max_, 'number')
    assert(min_<=max_)

    self._filters.push({
        'type': SphinxClient.SPH_FILTER_RANGE
        , 'attr': attribute
        , 'exclude': exclude
        , 'min': min_
        , 'max': max_
      } )
  }

SphinxClient.prototype.SetFilterFloatRange = function (attribute, min_, max_, exclude) {
    var self = this
    if (exclude === undefined) {
        exclude = 0
    }
    assert.equal(typeof attribute, 'string')
    assert.equal(typeof min_, 'number')
    assert.equal(typeof max_, 'number')
    assert(min_<=max_)

    self._filters.push({
        'type': SphinxClient.SPH_FILTER_FLOATRANGE,
        'attr': attribute,
        'exclude': exclude,
        'min': min_,
        'max': max_
    } )
}

SphinxClient.prototype.SetGeoAnchor = function (attrlat, attrlong, latitude, longitude) {
  var self = this
	assert.equal(typeof attrlat, 'string')
	assert.equal(typeof attrlong, 'string')
	assert.equal(typeof latitude, 'number')
	assert.equal(typeof longitude, 'number')
	self._anchor['attrlat'] = attrlat
	self._anchor['attrlong'] = attrlong
	self._anchor['lat'] = latitude
	self._anchor['long'] = longitude
};
SphinxClient.prototype.SetGroupBy = function (attribute, func, groupsort ) {
  var self = this
	if (groupsort == undefined) groupsort = '@group desc';
	assert.equal(typeof attribute, 'string')
	assert.equal(typeof groupsort, 'string')
	var funcs = [SphinxClient.SPH_GROUPBY_DAY, SphinxClient.SPH_GROUPBY_WEEK, SphinxClient.SPH_GROUPBY_MONTH, SphinxClient.SPH_GROUPBY_YEAR, SphinxClient.SPH_GROUPBY_ATTR, SphinxClient.SPH_GROUPBY_ATTRPAIR]
	assert(funcs.some(function (x) { return (x === func) }))
	self._groupby = attribute
	self._groupfunc = func
	self._groupsort = groupsort
};
SphinxClient.prototype.SetGroupDistinct = function (attribute) {
  var self = this
	assert.equal(typeof attribute, 'string')
	self._groupdistinct = attribute
};
SphinxClient.prototype.SetRetries = function (count, delay) {
  var self = this
	if (delay == undefined) delay = 0;
	assert.equal(typeof count, 'number')
	assert.equal(typeof delay, 'number')
	assert(count >= 0)
	assert(delay >= 0)
	self._retrycount = count
	self._retrydelay = delay
};
SphinxClient.prototype.SetOverride = function (name, type, values) {
  var self = this
	assert.equal(typeof name, 'string')
	assert(SphinxClient.SPH_ATTR_TYPES.some(function (x) { return (x === type) }))
	assert.equal(typeof values, 'object')
	self._overrides[name] = {
		'name': name,
		'type': type,
		'values': values
	}
};
SphinxClient.prototype.SetSelect = function (select) {
  var self = this
	assert.equal(typeof select, 'string')
	self._select = select
};
SphinxClient.prototype.ResetOverrides = function () {
  var self = this
	self._overrides = {}
};
SphinxClient.prototype.ResetFilters = function () {
  var self = this
	self._filters = []
	self._anchor = {}
};
SphinxClient.prototype.ResetGroupBy = function () {
  var self = this
	self._groupby = ''
	self._groupfunc = SphinxClient.SPH_GROUPBY_DAY
	self._groupsort = '@group desc'
	self._groupdistinct = ''
};
/**
* Connect to searchd server and run given search query.
*
* @api public
*/
SphinxClient.prototype.Query = function (query, index, comment, fn) {
  var self = this
	if (arguments.length == 2) {
		fn = arguments[1];
		index = '*';
		comment = '';
	}
	else if (arguments.length == 3) {
		fn = arguments[2];
		comment = '';
	}
	self.AddQuery(query, index, comment)

	self.RunQueries(function (err, results) {
			self._reqs = [] // we won't re-run erroneous batch

			if (err) {
				fn(err, null)
				return
			}
			if (results.length == 0) {
				fn(err, null)
				return
			}
			self._error = results[0].error
			self._warning = results[0].warning
			if (results[0].status == SphinxClient.SEARCHD_ERROR) {
				fn(results[0].error, null)
				return
			}
			fn(err, results[0])
	})

};
/**
* Add query to batch.
*
* @api public
*/
SphinxClient.prototype.AddQuery = function (query, index, comment) {
  var self = this
	if (index === undefined) index = '*';
	if (comment === undefined) comment = '';
	assert.equal(typeof query, 'string');
	var req = []
	req.push(pack('>LLLL', [self._offset, self._limit, self._mode, self._ranker]))
	if (self._ranker == SphinxClient.SPH_RANK_EXPR) {
		req.push(pack('>L', [len(self._rankexpr)]))
		req.push(self._rankexpr)
	}
	req.push(pack('>L', [self._sort]))
	req.push(pack('>L', [len(self._sortby)]))
	req.push(self._sortby)
	// TODO : check if query is encoding in utf8

	req.push(pack('>L', [len(query)]))
	req.push(query)

	req.push(pack('>L', [len(self._weights)]))
	forEach(self._weights, function (item, index) {
			req.push(pack('>L', [item])) // FIXME / TO VERIFY
	});
	req.push(pack('>L', [len(index)]))
	req.push(index)
	req.push(pack('>L', [1])) // id64 range marker

  //    req.push(pack('>Q',  [self._min_id]))
  req.push(packUInt64(self._min_id))
  //    req.push(pack('>Q', [self._max_id]))
  req.push(packUInt64(self._max_id))

	// filters
	req.push(pack('>L', [len(self._filters)]))
	forEach(self._filters, function (f, index) {
			req.push(pack('>L', [len(f.attr)]))
			req.push(f.attr)
			var filtertype = f.type
			req.push(pack('>L', [filtertype]))
			if (filtertype == SphinxClient.SPH_FILTER_VALUES) {
				req.push(pack('>L', [len(f.values)]))
				forEach(f.values, function (val, index) {
            //            req.push(pack('>q', [val]))
            req.push(packUInt64(val))
				});
			} else if (filtertype == SphinxClient.SPH_FILTER_RANGE) {
        //        req.push(pack('>q', [f.min]))
        req.push(packUInt64(f.min))
        //        req.push(pack('>q', [f.max]))
        req.push(packUInt64(f.max))
			}
			else if (filtertype == SphinxClient.SPH_FILTER_FLOATRANGE) {
				req.push(pack ('>f', [f.min]))
				req.push(pack ('>f', [f.max]))
      }
			else if (filtertype == SphinxClient.SPH_FILTER_STRING) {
				req.push(pack ('>L', [len(f.value)]))
				req.push(f.value);
			}
      req.push(pack('>L', [f.exclude]))
	});

	// group-by, max-matches, group-sort
	req.push(pack('>LL', [self._groupfunc, len(self._groupby)]))
	req.push(self._groupby)
	req.push(pack('>LL', [self._maxmatches, len(self._groupsort)]))
	req.push(self._groupsort)
	req.push(pack('>LLL', [self._cutoff, self._retrycount, self._retrydelay]))
	req.push(pack('>L', [len(self._groupdistinct)]))
	req.push(self._groupdistinct)

	// anchor point
	if (len(self._anchor) == 0) {
		req.push(pack('>L', [0]))
	}
	else {
		req.push(pack('>L', [1]))
    req.push(pack('>L', [len(self._anchor.attrlat)]) + self._anchor.attrlat)
    req.push(pack('>L', [len(self._anchor.attrlong)]) + self._anchor.attrlong)
		req.push(pack('>f', [self._anchor.lat]))
    req.push(pack('>f', [self._anchor.long]))
	}

	// per-index weights
	req.push(pack('>L', [len(self._indexweights)]))

	forEach(self._indexweights, function (weight, index) {
			req.push(pack('>L', [len(index)]))
			req.push(index)
			req.push(pack('>L', [weight]))
	});

	// max query time
	req.push(pack('>L', [self._maxquerytime]))

	// per-field weights
	req.push(pack('>L', [len(self._fieldweights)]))
	forEach(self._fieldweights, function (weight, field) {
			req.push(pack('>L', [len(field)]))
			req.push(field)
			req.push(pack('>L', [weight]))
	});

	// comment
	req.push(pack('>L', [len(comment)]))
	req.push(comment)

	// attribute overrides
	req.push(pack('>L', [len(self._overrides)]))

	forEach(self._overrides, function (v, index) {
			req.push(pack('>L', [len(v['name'])]))
			req.push(v['name'])
			req.push(pack('>LL', [v['type'], len(v['values'])]))
			forEach(v['values'], function (value, id) {
          //          req.push(pack('>Q', [id]))
          req.push(packUInt64(id))
					if (v['type'] == SphinxClient.SPH_ATTR_FLOAT) {
						req.push(pack('>f', [value]))
					}
					else if (v['type'] == SphinxClient.SPH_ATTR_BIGINT) {
            //            req.push(pack('>q', [value]))
            req.push(packInt64(id))
					}
					else {
						req.push(pack('>l', [value]))
					}
			});
	});

	// select-list
	req.push(pack('>L', [len(self._select)]))
	req.push(self._select)

	// send query, get response
	req = req.reduce(ReduceBuffer, new Buffer(''));

	self._reqs.push(req)

	debug('New Request Added', req.toString());
	return self._reqs.length - 1
};
/**
* Run queries batch.
* Returns None on network IO failure; or an array of result set hashes on success.
* @api public
*/
SphinxClient.prototype.RunQueries = function (fn) {
  var self = this
	var nreqs = self._reqs.length

	debug('Pool requests Size : '+ nreqs)
	if (nreqs == 0) {
		self._error = 'no queries defined, issue AddQuery() first'
		return null
	}

	var req = self._reqs.reduce(ReduceBuffer, new Buffer(''));

	var length = req.length + 8
	debug('Combined '+nreqs+' requests', req.toString())
	client_say('>HHLLL', [SphinxClient.SEARCHD_COMMAND_SEARCH, SphinxClient.VER_COMMAND_SEARCH, length, 0, nreqs]);
	var request = ConcatBuffer(pack('>HHLLL', [SphinxClient.SEARCHD_COMMAND_SEARCH, SphinxClient.VER_COMMAND_SEARCH, length, 0, self._reqs.length]), req)
	self._SendRequest(SphinxClient.VER_COMMAND_SEARCH, request, function (err, response) {

		if (response === null || response === undefined) {
			return fn(err, results)
		}
		// parse response
		var max_ = response.length
		var p = 0
		var results = []
		for (var i = 0; i < nreqs; i++) {
			debug('Parsing request #'+i)
			var result = {}
			results.push(result)

			result['error'] = ''
			result['warning'] = ''
			result['status'] = unpack('>L', response.slice(p, p + 4))
			p += 4
			if (result['status'] != SphinxClient.SEARCHD_OK) {
				length = Number(unpack('>L', response.slice(p, p + 4)))
				p += 4
        var message = response.slice(p, p+length)
				p += length

				if (result['status'] == SphinxClient.SEARCHD_WARNING) {
					result['warning'] = message.toString()
				}
				else {
					result['error'] = message.toString()
					continue
				}
			}
			// read schema
			result['fields'] = []
			var attrs = []

			var nfields = Number(unpack('>L', response.slice(p, p + 4)))
			p += 4
			while (nfields > 0 && p < max_) {
				nfields -= 1
				length = Number(unpack('>L', response.slice(p, p + 4)))
				p += 4
				result['fields'].push(response.slice(p, p + length).toString())
				p += length
			}

			var nattrs = Number(unpack('>L', response.slice(p, p + 4)))

			p += 4
			while (nattrs>0 && p<max_) {
				nattrs -= 1
				length = Number(unpack('>L', response.slice(p, p + 4)))
				p += 4
				var attr = response.slice(p, p + length).toString()
				p += length
				var type_ = Number(unpack('>L', response.slice(p, p + 4)))
				p += 4
				attrs.push([attr, type_])
			}
			result['attrs'] = attrs

			// read match count
			var count = Number(unpack('>L', response.slice(p, p + 4)))
			p += 4
			var id64 = Number(unpack('>L', response.slice(p, p + 4)))
			p += 4

			// read matches
			result['matches'] = []
			while (count>0 && p<max_) {
				var doc, weight
				count -= 1
        if (id64) {
          // doc = Number(unpack('>q', response.slice(p, p + 8)))
          doc = Number(unpackUInt64(response.slice(p, p + 8)))
          server_say('>q',doc)
					p += 8
          weight = Number(unpack('>L', response.slice(p, p + 4)))
					p += 4
				}
				else {
					doc = Number(unpack('>L', response.slice(p, p + 4)))
					p += 4
          weight = Number(unpack('>L', response.slice(p, p + 4)))
					p += 4
				}

				var match = { 'id':doc, 'weight':weight, 'attrs':{} }
				for (var j = 0;  j < result['attrs'].length; j++) {
					var attr0 = attrs[j][0]
					if (attrs[j][1] == SphinxClient.SPH_ATTR_FLOAT) {
						match['attrs'][attr0] = Number(unpack('>f', response.slice(p, p + 4)))
					}
					else if (attrs[j][1] == SphinxClient.SPH_ATTR_BIGINT) {
            //            match['attrs'][attr0] = Number(unpack('>q', response.slice(p, p + 8)))
            match['attrs'][attr0] = Number(unpackUInt64(response.slice(p, p + 8)))
						p += 4
					}
					else if (attrs[j][1] == SphinxClient.SPH_ATTR_STRING) {
						var slen = Number(unpack('>L', response.slice(p, p + 4)))
						p += 4
						match['attrs'][attr0] = ''
						if (slen>0) {
							match['attrs'][attr0] = response.slice(p, p + slen).toString()
						}
						p += slen-4
					}
					else if (attrs[j][1] == SphinxClient.SPH_ATTR_MULTI) {
						match['attrs'][attr0] = []
            var nvals = Number(unpack('>L', response.slice(p, p + 4)))
            p += 4
						for (var n = 0; n < nvals; n++) {
							match['attrs'][attr0].push(Number(unpack('>L', response.slice(p, p + 4))))
							p += 4
						}
            p -= 4
					}
					else if (attrs[j][1] == SphinxClient.SPH_ATTR_MULTI64) {
						match['attrs'][attr0] = []
						nvals = Number(unpack('>L', response.slice(p, p + 4)))
						nvals = nvals/2
						p += 4
						for (var n = 0; n < nvals; n++) {
              //              match['attrs'][attr0].push(Number(unpack('>q', response.slice(p, p + 8))))
              match['attrs'][attr0].push(Number(unpackUInt64(response.slice(p, p + 8))))
							p += 8
						}
            p -= 4
					}
					else {
						match['attrs'][attr0] = Number(unpack('>L', response.slice(p, p + 4)))
					}
					p += 4
				}
				result['matches'].push( match )
			}
			result['total'] = Number(unpack('>L', response.slice(p, p + 4)))
			p += 4
			result['total_found'] = Number(unpack('>L', response.slice(p, p + 4)))
			p += 4
			result['time'] = Number(unpack('>L', response.slice(p, p + 4)))
			p += 4
			var words = Number(unpack('>L', response.slice(p, p + 4)))
			p += 4

			result['time'] = (result['time']/1000.0)

			result['words'] = []
			while (words>0) {
				words -= 1
				var length = Number(unpack('>L', response.slice(p, p + 4)))
				p += 4
				var word = response.slice(p, p + length).toString()
				p += length
				var docs = Number(unpack('>L', response.slice(p, p + 4)))
				p += 4
				var hits = Number(unpack('>L', response.slice(p, p + 4)))
				p += 4

				result['words'].push({'word':word, 'docs':docs, 'hits':hits})
			}
		}

		fn(err, results)
	})

    this._reqs = []
};
SphinxClient.prototype.BuildExcerpts = function (docs, index, words, opts, cb) {
	assert.equal(Array.isArray(docs), true);
	assert.equal(typeof index, 'string');
	assert.equal(typeof words, 'string');
	if (opts) {
		assert.equal(typeof opts, 'object');
	} else {
		opts = {};
	}

	opts.before_match         = typeof opts.before_match !== 'undefined'         ? opts.before_match         : "<b>";
	opts.after_match          = typeof opts.after_match !== 'undefined'          ? opts.after_match          : "</b>";
	opts.chunk_separator      = typeof opts.chunk_separator !== 'undefined'      ? opts.chunk_separator      : " ... ";
	opts.limit                = typeof opts.limit !== 'undefined'                ? opts.limit                : 256;
	opts.limit_passages       = typeof opts.limit_passages !== 'undefined'       ? opts.limit_passages       : 0;
	opts.limit_words          = typeof opts.limit_words !== 'undefined'          ? opts.limit_words          : 0;
	opts.around               = typeof opts.around !== 'undefined'               ? opts.around               : 5;
	opts.exact_phrase         = typeof opts.exact_phrase !== 'undefined'         ? opts.exact_phrase         : false;
	opts.single_passage       = typeof opts.single_passage !== 'undefined'       ? opts.single_passage       : false;
	opts.use_boundaries       = typeof opts.use_boundaries !== 'undefined'       ? opts.use_boundaries       : false;
	opts.weight_order         = typeof opts.weight_order !== 'undefined'         ? opts.weight_order         : false;
	opts.query_mode           = typeof opts.query_mode !== 'undefined'           ? opts.query_mode           : false;
	opts.force_all_words      = typeof opts.force_all_words !== 'undefined'      ? opts.force_all_words      : false;
	opts.start_passage_id     = typeof opts.start_passage_id !== 'undefined'     ? opts.start_passage_id     : 1;
	opts.load_files           = typeof opts.load_files !== 'undefined'           ? opts.load_files           : false;
	opts.html_strip_mode      = typeof opts.html_strip_mode !== 'undefined'      ? opts.html_strip_mode      : "index";
	opts.allow_empty          = typeof opts.allow_empty !== 'undefined'          ? opts.allow_empty          : false;
	opts.passage_boundary     = typeof opts.passage_boundary !== 'undefined'     ? opts.passage_boundary     : "none";
	opts.emit_zones           = typeof opts.emit_zones !== 'undefined'           ? opts.emit_zones           : false;
	opts.load_files_scattered = typeof opts.load_files_scattered !== 'undefined' ? opts.load_files_scattered : false;

	var flags = 1; // remove spaces
	if (opts.exact_phrase) flags = flags | 2;
	if (opts.single_passage) flags = flags | 4;
	if (opts.use_boundaries) flags = flags | 8;
	if (opts.weight_order) flags = flags | 16;
	if (opts.query_mode) flags = flags | 32;
	if (opts.force_all_words) flags = flags | 64;
	if (opts.load_files) flags = flags | 128;
	if (opts.allow_empty) flags = flags | 256;
	if (opts.emit_zones) flags = flags | 512;
	if (opts.load_files_scattered) flags = flags | 1024;

	var req = [];

	req.push(pack('>LL', [ 0, flags ]));
	req.push(pack('>L', [len(index)]), index);
	req.push(pack('>L', [len(words)]), words);

	req.push(pack('>L', [len(opts.before_match)]), opts.before_match);
	req.push(pack('>L', [len(opts.after_match)]), opts.after_match);
	req.push(pack('>L', [len(opts.chunk_separator)]), opts.chunk_separator);
	req.push(pack('>LL', [opts.limit, opts.around]));
	req.push(pack('>LLL', [opts.limit_passages, opts.limit_words, opts.start_passage_id]));
	req.push(pack('>L', [len(opts.html_strip_mode)]), opts.html_strip_mode);
	req.push(pack('>L', [len(opts.passage_boundary)]), opts.passage_boundary);
	req.push(pack('>L', [docs.length]));

	for (var i = 0, l = docs.length; i < l; i++) {
		var doc = docs[i];
		assert.equal(typeof doc, 'string');
		req.push(pack('>L', [len(doc)]), doc);
	}

	var reqData = req.reduce(ReduceBuffer, new Buffer(''));
	var length = reqData.length;

	debug('Build excerpts request:', reqData.toString());

	var request = ConcatBuffer(pack('>HHL', [SphinxClient.SEARCHD_COMMAND_EXCERPT, SphinxClient.VER_COMMAND_EXCERPT, length]), reqData);
	this._SendRequest(SphinxClient.VER_COMMAND_EXCERPT, request, function (err, response) {
		if (err) {
			return cb(err, null);
		}
		var results = [], p = 0, rlen = response.length;
		for (var i = 0, l = docs.length; i < l; i++) {
			var len = unpack('>L', response.slice(p, p + 4))[0];
			p += 4;
			if (p + len > rlen) {
				return cb(new Error('Incomplete reply from searchd'), null);
			}
			results.push(len ? response.slice(p, p + len).toString('utf8') : '');
			p += len;
		}
		cb(null, results);
		return null;
	});
};
SphinxClient.prototype.UpdateAttributes = function (index, attrs, values, mva) {
	if (mva === undefined) mva = false;
};
SphinxClient.prototype.BuildKeywords = function (query, index, hits, cb ) {
	assert.equal(typeof query, 'string');
	assert.equal(typeof index, 'string');
	assert.equal(typeof hits, 'boolean');

	var req = [];

	req.push(pack('>L', [len(query)]), query);
	req.push(pack('>L', [len(index)]), index);
	req.push(pack('>L', [hits?1:0]));

	var reqData = req.reduce(ReduceBuffer, new Buffer(''));
	var length = reqData.length;

	debug('Build keywords request:', reqData.toString());

	var request = ConcatBuffer(pack('>2HL', [SphinxClient.SEARCHD_COMMAND_KEYWORDS, SphinxClient.VER_COMMAND_KEYWORDS, length]), reqData);
	this._SendRequest(SphinxClient.VER_COMMAND_KEYWORDS, request, function (err, response) {
		if (err) {
			return cb(err, null);
		}
		// parse response
		var results = [], p = 0, rlen = response.length;
		var nwords = unpack ( '>L', response.slice(p,p+4) )[0];
		p = 4;
		for (var i = 0; i < nwords; i++){
			var len = unpack('>L', response.slice(p, p + 4))[0];
			p += 4;

			if (p + len > rlen) {
				return cb(new Error('Incomplete reply from searchd'), null);
			}

			var tokenized = len ? response.slice(p, p + len).toString('utf8') : '';
			p += len;

			len = unpack('>L', response.slice(p, p + 4))[0];
			p += 4;
			var normalized = len ? response.slice(p, p + len).toString('utf8') : '';
			p += len;
			var entry = { 'tokenized':tokenized, 'normalized':normalized };
			if(hits){
				var d = unpack('>2L', response.slice(p, p + 8));
				entry.docs = d[0];
				entry.hits = d[1];
				p += 8;
			}
			results.push(entry);
		}
		cb(null, results);
		return null;
	});
};

/**
* Get the status
*
* @api public
*/
SphinxClient.prototype.Status = function (fn) {
  var self = this
	client_say('>2HLL', [SphinxClient.SEARCHD_COMMAND_STATUS, SphinxClient.VER_COMMAND_STATUS, 4, 1]);
	var request = pack( '>2HLL', [SphinxClient.SEARCHD_COMMAND_STATUS, SphinxClient.VER_COMMAND_STATUS, 4, 1])
	self._SendRequest(SphinxClient.VER_COMMAND_STATUS, request, function (err, response) {
		var result = {}, p = 8;
		if (!err) while (p < response.length) {
			var length, k, v;
			length = Number(unpack('>L', response.slice(p, p + 4)))
			k = response.slice(p + 4, p + length + 4)
			p += 4 + length
			length = Number(unpack('>L', response.slice(p, p + 4)))
			v = response.slice(p + 4, p + length + 4)
			p += 4 + length
			result[k] = v.toString()
		}
		fn(err, result);
	})
};
SphinxClient.prototype.Open = function (fn) {
//  var self = this
// command, command version = 0, body length = 4, body = 1
//        var request = pack ( '>hhII', [SphinxClient.SEARCHD_COMMAND_PERSIST, 0, 4, 1] )
//        self._SendRequest(null, request, function (err, response) {
//                fn(err, null)
//        })
};
SphinxClient.prototype.Close = function () {
};
SphinxClient.prototype.EscapeString = function (string) {
//    return re.sub(r"([=\(\)|\-!@~\"&/\\\^\$\=])", r"\\\1", string)


};
SphinxClient.prototype.FlushAttributes = function (fn) {
  var self = this
	var request = pack ( '>hhI', [SphinxClient.SEARCHD_COMMAND_FLUSHATTRS, SphinxClient.VER_COMMAND_FLUSHATTRS, 0] )
	self._SendRequest(SphinxClient.VER_COMMAND_FLUSHATTRS, request, function (err, response) {
		if (err) {
			return fn(err, null)
		}
		if (response.length != 4) {
			self._error = 'unexpected response length'
			return fn(err, null)
		}
		var tag = Number(unpack('>L', response.slice(0, 4)))
		return fn(err, tag)
	})
};


// known searchd commands
SphinxClient.SEARCHD_COMMAND_SEARCH		= 0
SphinxClient.SEARCHD_COMMAND_EXCERPT		= 1
SphinxClient.SEARCHD_COMMAND_UPDATE		= 2
SphinxClient.SEARCHD_COMMAND_KEYWORDS	= 3
SphinxClient.SEARCHD_COMMAND_PERSIST		= 4
SphinxClient.SEARCHD_COMMAND_STATUS		= 5
SphinxClient.SEARCHD_COMMAND_FLUSHATTRS	= 7

// current client-side command implementation versions
SphinxClient.VER_COMMAND_SEARCH		= 0x119
SphinxClient.VER_COMMAND_EXCERPT	= 0x104
SphinxClient.VER_COMMAND_UPDATE		= 0x102
SphinxClient.VER_COMMAND_KEYWORDS	= 0x100
SphinxClient.VER_COMMAND_STATUS		= 0x100
SphinxClient.VER_COMMAND_FLUSHATTRS	= 0x100

// known searchd status codes
SphinxClient.SEARCHD_OK				= 0
SphinxClient.SEARCHD_ERROR			= 1
SphinxClient.SEARCHD_RETRY			= 2
SphinxClient.SEARCHD_WARNING		= 3

// known match modes
SphinxClient.SPH_MATCH_ALL			= 0
SphinxClient.SPH_MATCH_ANY			= 1
SphinxClient.SPH_MATCH_PHRASE		= 2
SphinxClient.SPH_MATCH_BOOLEAN		= 3
SphinxClient.SPH_MATCH_EXTENDED		= 4
SphinxClient.SPH_MATCH_FULLSCAN		= 5
SphinxClient.SPH_MATCH_EXTENDED2	= 6

// known ranking modes (extended2 mode only)
SphinxClient.SPH_RANK_PROXIMITY_BM25= 0 // default mode, phrase proximity major factor and BM25 minor one
SphinxClient.SPH_RANK_BM25			= 1 // statistical mode, BM25 ranking only (faster but worse quality)
SphinxClient.SPH_RANK_NONE			= 2 // no ranking, all matches get a weight of 1
SphinxClient.SPH_RANK_WORDCOUNT		= 3 // simple word-count weighting, rank is a weighted sum of per-field keyword occurence counts
SphinxClient.SPH_RANK_PROXIMITY		= 4
SphinxClient.SPH_RANK_MATCHANY		= 5
SphinxClient.SPH_RANK_FIELDMASK		= 6
SphinxClient.SPH_RANK_SPH04			= 7
SphinxClient.SPH_RANK_EXPR			= 8
SphinxClient.SPH_RANK_TOTAL			= 9

// known sort modes
SphinxClient.SPH_SORT_RELEVANCE		= 0
SphinxClient.SPH_SORT_ATTR_DESC		= 1
SphinxClient.SPH_SORT_ATTR_ASC		= 2
SphinxClient.SPH_SORT_TIME_SEGMENTS	= 3
SphinxClient.SPH_SORT_EXTENDED		= 4
SphinxClient.SPH_SORT_EXPR			= 5

// known filter types
SphinxClient.SPH_FILTER_VALUES		= 0
SphinxClient.SPH_FILTER_RANGE		= 1
SphinxClient.SPH_FILTER_FLOATRANGE	= 2
SphinxClient.SPH_FILTER_STRING	 = 3

// known attribute types
SphinxClient.SPH_ATTR_NONE			= 0
SphinxClient.SPH_ATTR_INTEGER		= 1
SphinxClient.SPH_ATTR_TIMESTAMP		= 2
SphinxClient.SPH_ATTR_ORDINAL		= 3
SphinxClient.SPH_ATTR_BOOL			= 4
SphinxClient.SPH_ATTR_FLOAT			= 5
SphinxClient.SPH_ATTR_BIGINT		= 6
SphinxClient.SPH_ATTR_STRING		= 7
SphinxClient.SPH_ATTR_MULTI			= 0x40000001
SphinxClient.SPH_ATTR_MULTI64		= 0x40000002

SphinxClient.SPH_ATTR_TYPES = [
	SphinxClient.SPH_ATTR_NONE,
	SphinxClient.SPH_ATTR_INTEGER,
	SphinxClient.SPH_ATTR_TIMESTAMP,
	SphinxClient.SPH_ATTR_ORDINAL,
	SphinxClient.SPH_ATTR_BOOL,
	SphinxClient.SPH_ATTR_FLOAT,
	SphinxClient.SPH_ATTR_BIGINT,
	SphinxClient.SPH_ATTR_STRING,
	SphinxClient.SPH_ATTR_MULTI,
	SphinxClient.SPH_ATTR_MULTI64
]

// known grouping functions
SphinxClient.SPH_GROUPBY_DAY	 	= 0
SphinxClient.SPH_GROUPBY_WEEK		= 1
SphinxClient.SPH_GROUPBY_MONTH		= 2
SphinxClient.SPH_GROUPBY_YEAR		= 3
SphinxClient.SPH_GROUPBY_ATTR		= 4
SphinxClient.SPH_GROUPBY_ATTRPAIR	= 5


module.exports = SphinxClient;
