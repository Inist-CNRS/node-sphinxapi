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

function ConcatBuffer(a, b) {
	var t = new Buffer(a.length + b.length)
	a.copy(t, 0, 0)
	b.copy(t, a.length, 0)
	return t
}
function ReduceBuffer(a, b) { 
	if (typeof b != 'object') {
		b = new Buffer(b)
	}
	return ConcatBuffer(a, b); 
}

function forEach(o, fn) {
	if (Array.isArray(o)) {
		return o.forEach(fn);
	}
	else {
		for (var key in o) {
			if (o.hasOwnProperty(key)) {
				fn(key, o[key])
			}
		}
	}
}
function len (o){    
	if (Array.isArray(o) || typeof o == 'string') {
		return o.length;
	}
	else {
		var k, l = 0;
		for(k in o) {
			l += Number( obj.hasOwnProperty(k) );
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
	if ( !(this instanceof SphinxClient) ) {
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
	this._groupfunc		= SphinxClient.SPH_GROUPBY_DAY  // group-by function (to pre-process group-by attribute value with)
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
SphinxClient.prototype._SetRequest = function(client_ver, request, fn) {
	debug('Connecting to '+this._host+':'+this._port);
	var client = net.connect(this._port, this._host);
	client.on('connect', function() {
			client_say('connected')
	});
	client.once('data', function(chunk) {
			chunk.slice(0,4)

			var response = unpack('>L', chunk);
			server_say('>L', response);
			if (!Array.isArray(response)) {
				fn(new Error('connection to '+this._host+':'+this._port+' failed'))
			} else if (Array.isArray(response) && response[0] < 1) {
				fn(new Error('expected searchd protocol version, got '+response[0]))
			}
			else {
				client_say('received version', client_ver);
			}
			var content, state, version, length;
			client.on('data', function(chunk) {
					if (content == undefined) {
						client_say('received the response');
						response = unpack('>2HL', chunk)
						server_say('>2HL',response);
						state   = response[0]
						version = response[1]
						length  = response[2]
						content = chunk.slice(8)
						client_say('processing the response #1', state, version, length);
					}
					else {
						client_say('received following the response ');
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
							err = new Error('searchd error: '+content.slice(4).toString());
							content = null;
						}
						else if (state == SphinxClient.SEARCHD_RETRY) {
							err = new Error('temporary searchd error: '+content.slice(4).toString())
							content = null;
						}
						else if (state != SphinxClient.SEARCHD_OK) {
							err = new Error('unknown status code '+state)
							content = null;
						}

						if (version < client_ver) {
							var warning = util.format('searchd command v.%d.%d older than client\'s v.%d.%d, some options might not work',
								version>>8, version&0xff, client_ver>>8, client_ver&0xff)
							// TODO do something with the warning !!!
						}

						fn(err, content)
					}
			});
			client_say('sending a request', request.toString());
//             process.stdout.write(request.toString('hex')+'\n')
			client.write(request);
	});
	client.on('end', function() {
			client_say('disconnected');
	});
	client.on('error', function(err) {
			fn(new Error('searchd connexion error'))
	});
	client.write(pack('>L', 1))
};

SphinxClient.prototype.GetLastError = function() {
};
SphinxClient.prototype.GetLastWarning = function() {
};
/**
* Set searchd server host and port.
*
* @api public
*/
SphinxClient.prototype.SetServer = function(host, port) {
	assert.equal(typeof host, 'string')
	assert.equal(typeof port, 'number')
	this._host = host;
	this._port = port;
};
SphinxClient.prototype.SetConnectTimeout = function(timeout ) {
	assert.equal(typeof timeout, 'float')
	this._timeout = Math.max(0.001, timeout);
};
SphinxClient.prototype.SetLimits = function(offset, limit, maxmatches, cutoff) {
	assert.equal(typeof offset, 'number')
	assert.equal(typeof limit, 'number')
	assert(0 <= offset < 16777216)
	assert(0 <= limit < 16777216)
	if (maxmatches == undefined) {
		maxmatches = 0
	}
	if (cutoff == undefined) {
		cutoff = 0
	}
	assert(maxmatches >= 0)
	this._offset = offset
	this._limit = limit
	if (maxmatches > 0) {
		this._maxmatches = maxmatches
	}
	if (cutoff >= 0) {
		this._cutoff = cutoff
	}
};
SphinxClient.prototype.SetMaxQueryTime = function(maxquerytime) {
	assert.equal(typeof maxquerytime, 'number')
	assert(maxquerytime > 0)
	this._maxquerytime = maxquerytime
};
SphinxClient.prototype.SetMatchMode = function(mode) {
	var modes = [SphinxClient.SPH_MATCH_ALL, SphinxClient.SPH_MATCH_ANY, SphinxClient.SPH_MATCH_PHRASE, SphinxClient.SPH_MATCH_BOOLEAN, SphinxClient.SPH_MATCH_EXTENDED, SphinxClient.SPH_MATCH_FULLSCAN, SphinxClient.SPH_MATCH_EXTENDED2]
	assert(modes.some(function(x) { return (x === mode) }))
	this._mode = mode
};
SphinxClient.prototype.SetRankingMode = function(ranker, rankexpr) {
	if (rankexpr == undefined) rankexpr = '';
	assert(0 <= ranker && ranker < SphinxClient.SPH_RANK_TOTAL)
	this._ranker = ranker
	this._rankexpr = rankexpr
};
SphinxClient.prototype.SetSortMode = function(mode, clause) {
	if (clause == undefined) clause = '';
};
SphinxClient.prototype.SetWeights = function(weights) {
	assert(Array.isArray(weights))
	forEach(weights, function(item, index) {
			assert.equal(typeof item, 'number')
	})
	this._weights = weights
};
SphinxClient.prototype.SetFieldWeights = function(weights) {
	assert.equal(typeof item, 'object')
	forEach(weights, function(item, index) {
			assert.equal(typeof item, 'number')
	})
	this._fieldweights = weights
};
SphinxClient.prototype.SetIndexWeights = function(weights) {
	assert.equal(typeof item, 'object')
	forEach(weights, function(item, index) {
			assert.equal(typeof item, 'number')
	})
	this._indexweights = weights
};
SphinxClient.prototype.SetIDRange = function(minid, maxid) {
	assert.equal(typeof minid, 'number')
	assert.equal(typeof maxid, 'number')
	assert(minid <= maxid)
	this._min_id = minid
	this._max_id = maxid
};
SphinxClient.prototype.SetFilter = function(attribute, values, exclude) {
	if (exclude == undefined) exclude = 0;
	assert.equal(typeof attribute, 'string')
	forEach(values, function(item, index) {
			assert.equal(typeof item, 'number')
	})
	this._filters.push({
			'type': SphinxClient.SPH_FILTER_VALUES, 
			'attr': attribute, 
			'exclude': exclude, 
			'values': values 
		})
};
SphinxClient.prototype.SetGeoAnchor = function(attrlat, attrlong, latitude, longitude) {
	assert.equal(typeof attrlat, 'string')
	assert.equal(typeof attrlong, 'string')
	assert.equal(typeof latitude, 'float')
	assert.equal(typeof longitude, 'float')
	this._anchor['attrlat'] = attrlat
	this._anchor['attrlong'] = attrlong
	this._anchor['lat'] = latitude
	this._anchor['long'] = longitude
};
SphinxClient.prototype.SetGroupBy = function(attribute, func, groupsort ) {
	if (groupsort == undefined) groupsort = '@group desc';
	assert.equal(typeof attribute, 'string')
	assert.equal(typeof groupsort, 'string')
	var funcs = [SphinxClient.SPH_GROUPBY_DAY, SphinxClient.SPH_GROUPBY_WEEK, SphinxClient.SPH_GROUPBY_MONTH, SphinxClient.SPH_GROUPBY_YEAR, SphinxClient.SPH_GROUPBY_ATTR, SphinxClient.SPH_GROUPBY_ATTRPAIR]
	assert(funcs.some(function(x) { return (x === func) }))
	this._groupby = attribute
	this._groupfunc = func
	this._groupsort = groupsort
};
SphinxClient.prototype.SetGroupDistinct = function(attribute) {
	assert.equal(typeof attribute, 'string')
	this._groupdistinct = attribute
};
SphinxClient.prototype.SetRetries = function(count, delay) {
	if (delay == undefined) delay = 0;
	assert.equal(typeof count, 'number')
	assert.equal(typeof delay, 'number')
	assert(count >= 0)
	assert(delay >= 0)
	this._retrycount = count
	this._retrydelay = delay
};
SphinxClient.prototype.SetOverride = function(name, type, values) {
	assert.equal(typeof name, 'string')
	assert(SphinxClient.SPH_ATTR_TYPES.some(function(x) { return (x === type) }))
	assert.equal(typeof values, 'object')
	this._overrides[name] = {
		'name': name, 
		'type': type, 
		'values': values
	}
};
SphinxClient.prototype.SetSelect = function(select) {
	assert.equal(typeof select, 'string')
	this._select = select
};
SphinxClient.prototype.ResetOverrides = function() {
	this._overrides = {}
};
SphinxClient.prototype.ResetFilters = function() {
	this._filters = []
	this._anchor = {}
};
SphinxClient.prototype.ResetGroupBy = function() {
	this._groupby = ''
	this._groupfunc = SphinxClient.SPH_GROUPBY_DAY
	this._groupsort = '@group desc'
	this._groupdistinct = ''
};
/**
* Connect to searchd server and run given search query.
*
* @api public
*/
SphinxClient.prototype.Query = function(query, index, comment, fn) {
	if (arguments.length == 2) {
		fn = arguments[1];
		index = '*';
		comment = '';
	}
	else if (arguments.length == 3) {
		fn = arguments[2];
		comment = '';
	} 
	this.AddQuery(query, index, comment)

	this.RunQueries(function(err, results) {
			fn(err, results);
			/*
	this._reqs = [] // we won't re-run erroneous batch

	if (results.length == 0)
		return null;
	this._error = results[0].error
	this._warning = results[0].warning
	if (results[0].status == SphinxClient.SEARCHD_ERROR)
		return null;

	return results[0]
	*/
	
	})
	
};
/**
* Add query to batch.
*
* @api public
*/
SphinxClient.prototype.AddQuery = function(query, index, comment) {
	if (index == undefined) index = '*';
	if (comment == undefined) comment = '';
	assert.equal(typeof query, 'string');
	var req = []
	req.push(pack('>LLLL', [this._offset, this._limit, this._mode, this._ranker]))
	if (this._ranker == SphinxClient.SPH_RANK_EXPR) {
		req.push(pack('>L', [len(this._rankexpr)]))
		req.push(this._rankexpr)
	}
	req.push(pack('>L', [this._sort]))
	req.push(pack('>L', [len(this._sortby)]))
	req.push(this._sortby)
	// TODO : check if query is encoding in utf8

	req.push(pack('>L', [len(query)]))
	req.push(query)

	req.push(pack('>L', [len(this._weights)]))
	forEach(this._weights, function(item, index) {
			req.push(pack('>L', [item])) // FIXME / TO VERIFY
	});
	req.push(pack('>L', [len(index)]))
	req.push(index)
	req.push(pack('>L', [1])) // id64 range marker


req.push(Put().word64be(this._min_id).word64be(this._max_id).buffer())
//    req.push(pack('>Q',  [this._min_id]))
//    req.push(pack('>Q', [this._max_id]))

	// filters
	req.push(pack('>L', [len(this._filters)]))
	forEach(this._filters, function(f, index) {
			req.push(pack('>L', [len(f.attr)]))
			req.push(f.attr)
			filtertype = f.type
			req.push(pack('>L', [filtertype]))
			if (filtertype == SphinxClient.SPH_FILTER_VALUES) {
				req.push(pack('>L', [len(f.values)]))
				forEach(f.values, function(val, index) {
						req.push(pack('>q', [val]))
				});
			} else if (filtertype == SphinxClient.SPH_FILTER_RANGE) {
				req.push(pack('>qq', [f.min, f.max]))
			}
			else if (filtertype == SphinxClient.SPH_FILTER_FLOATRANGE) {
				req.push(pack ('>ff', [f.min, f.max]))
				req.push(pack('>L', [f.exclude]))
			}
	});

	// group-by, max-matches, group-sort
	req.push(pack('>LL', [this._groupfunc, len(this._groupby)]))
	req.push(this._groupby)
	req.push(pack('>LL', [this._maxmatches, len(this._groupsort)]))
	req.push(this._groupsort)
	req.push(pack('>LLL', [this._cutoff, this._retrycount, this._retrydelay])) 
	req.push(pack('>L', [len(this._groupdistinct)]))
	req.push(this._groupdistinct)

	// anchor point
	if (len(this._anchor) == 0) {
		req.push(pack('>L', [0]))
	}
	else {
		req.push(pack('>L', [1]))
		req.push(pack('>L', [len(this._anchor.attrlat) + this._anchor.attrlat]))
		req.push(pack('>L', [len(this._anchor.attrlong) + this._anchor.attrlong]))
		req.push(pack('>f', [this._anchor.lat]))
	   	req.push(pack('>f', [this._anchor.long]))
	}

	// per-index weights
	req.push(pack('>L', [len(this._indexweights)]))

	forEach(this._indexweights, function(index, weight) {
			req.push(pack('>L', [len(index)]))
			req.push(index)
			req.push(pack('>L', [weight]))
	});

	// max query time
	req.push(pack('>L', [this._maxquerytime]))

	// per-field weights
	req.push(pack('>L', [len(this._fieldweights)]))
	forEach(this._fieldweights, function(field, weight) {
			req.push(pb.pack('>L', [len(field)]))
			req.push(field)
			req.push(pack('>L', [weight]))
	});

	// comment
	req.push(pack('>L', [len(comment)]))
	req.push(comment)

	// attribute overrides
	req.push(pack('>L', [len(this._overrides)]))

	forEach(this._overrides, function(index, v) {
			req.push(pack('>L', [len(v['name'])]))
			req.push(v['name'])
			req.push(pack('>LL', [v['type'], len(v['values'])]))
			forEach(v['values'], function(value, id) {
					req.push(pack('>Q', [id]) )
					if (v['type'] == SphinxClient.SPH_ATTR_FLOAT) {
						req.push(pack('>f', [value]))
					}
					else if (v['type'] == SphinxClient.SPH_ATTR_BIGINT) {
						req.push(pack('>q', [value]))
					}
					else {
						req.push(pack('>l', [value]))
					}
			});
	});

	// select-list
	req.push(pack('>L', [len(this._select)]))
	req.push(this._select)

	// send query, get response
	req = req.reduce(ReduceBuffer, new Buffer(''));

	this._reqs.push(req)

	debug('New Request Added', req.toString());
	return this._reqs.length - 1 
};
/**
* Run queries batch.
* Returns None on network IO failure; or an array of result set hashes on success.
* @api public
*/
SphinxClient.prototype.RunQueries = function(fn) {
	result = {};
	var nreqs = this._reqs.length

	debug('Pool requests Size : '+ nreqs)
	if (nreqs == 0) {
		this._error = 'no queries defined, issue AddQuery() first'
		return null
	}

	var req = this._reqs.reduce(ReduceBuffer, new Buffer(''));

	var length = req.length + 8
	debug('Combined '+nreqs+' requests', req.toString())
	client_say('>HHLLL', [SphinxClient.SEARCHD_COMMAND_SEARCH, SphinxClient.VER_COMMAND_SEARCH, length, 0, nreqs]);
	var request = ConcatBuffer(pack('>HHLLL', [SphinxClient.SEARCHD_COMMAND_SEARCH, SphinxClient.VER_COMMAND_SEARCH, length, 0, this._reqs.length]), req)
	this._SetRequest(SphinxClient.VER_COMMAND_SEARCH, request, function(err, response) {


		// parse response
		var max_ = response.length
		var p = 0
		var results = []
		for (i = 0; i < nreqs; i++) {
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
				message = response.slice(p, p+length)
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
					doc = Number(unpack('>q', response.slice(p, p + 8)))
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

				match = { 'id':doc, 'weight':weight, 'attrs':{} }
				for (i = 0; i < result['attrs'].length; i++) {
					var attr0 = attrs[i][0]
					if (attrs[i][1] == SphinxClient.SPH_ATTR_FLOAT) {
						match['attrs'][attr0] = Number(unpack('>f', response.slice(p, p + 4)))
					}
					else if (attrs[i][1] == SphinxClient.SPH_ATTR_BIGINT) {
						match['attrs'][attr0] = Number(unpack('>q', response.slice(p, p + 8)))
						p += 4
					}
					else if (attrs[i][1] == SphinxClient.SPH_ATTR_STRING) {
						var slen = Number(unpack('>L', response.slice(p, p + 4)))
						p += 4
						match['attrs'][attr0] = ''
						if (slen>0) {
							match['attrs'][attr0] = response.slice(p, p + slen).toString()
						}
						p += slen-4
					} 
					else if (attrs[i][1] == SphinxClient.SPH_ATTR_MULTI) {
						match['attrs'][attr0] = []
						var  nvals = Number(unpack('>L', response.slice(p, p + 4)))
						p += 4
						for (n = 0; n > nvals; n++) {
							match['attrs'][attr0].push(Number(unpack('>L', response.slice(p, p + 4))))
							p += 4
							p -= 4
						}
					}
					else if (attrs[i][1] == SphinxClient.SPH_ATTR_MULTI64) {
						match['attrs'][attr0] = []
						nvals = Number(unpack('>L', response.slice(p, p + 4)))
						nvals = nvals/2
						p += 4
						for (n = 0; n < nvals; n++) {
							match['attrs'][attr0].push(Number(unpack('>q', response.slice(p, p + 8))))
							p += 8
							p -= 4
						}
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
				word = response.slice(p, p + length).toString()
				p += length
				docs = Number(unpack('>L', response.slice(p, p + 4)))
				p += 4
				hits = Number(unpack('>L', response.slice(p, p + 4)))
				p += 4

				result['words'].push({'word':word, 'docs':docs, 'hits':hits})
			}	
		}
		this._reqs = []

		fn(err, results);
	})
};
SphinxClient.prototype.BuildExcerpts = function(docs, index, words, opts) {
};
SphinxClient.prototype.UpdateAttributes = function(index, attrs, values, mva) {
	if (mva == undefined) mva = false;
};
SphinxClient.prototype.BuildKeywords = function(query, index, hits ) {
};

/**
* Get the status
*
* @api public
*/
SphinxClient.prototype.Status = function(fn) {
	client_say('>2HLL', [SphinxClient.SEARCHD_COMMAND_STATUS, SphinxClient.VER_COMMAND_STATUS, 4, 1]);
	request = pack( '>2HLL', [SphinxClient.SEARCHD_COMMAND_STATUS, SphinxClient.VER_COMMAND_STATUS, 4, 1])
//    request1 = pack( '>2H', [SphinxClient.SEARCHD_COMMAND_STATUS, SphinxClient.VER_COMMAND_STATUS])
//    request2 = pack( '>2L', [4, 1])
//    var req = []
//    req.push(request1);
//    req.push(request2);
//    request = req.reduce(ReduceBuffer, new Buffer(''))
//    request = ConcatBuffer(request1, request2)
	this._SetRequest(SphinxClient.VER_COMMAND_STATUS, request, function(err, response) {
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
SphinxClient.prototype.Open = function() {
};
SphinxClient.prototype.Close = function() {
};
SphinxClient.prototype.EscapeString = function(string) {
};
SphinxClient.prototype.FlushAttributes = function() {
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
