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
	assert = require('assert'),
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
	this._groupfunc		= SphinxClient.SPH_GROUPBY_DAY			// group-by function (to pre-process group-by attribute value with)
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

	this.error			= ''							// last error message
	this.warning		= ''							// last warning message
	this.reqs			= []							// requests array for multi-query
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

			var response = bp.unpack('>L', chunk);
			server_say('>L', response);
			if (!Array.isArray(response)) {
				fn(new Error('connection to '+this._host+':'+this._port+' failed'))
			} else if (Array.isArray(response) && response[0] < 1) {
				fn(new Error('expected searchd protocol version, got '+response[0]))
			}
			else {
				client_say('received version');
			}
			var content, state, version, length;
			client.on('data', function(chunk) {
					if (content == undefined) {
						client_say('received the response');
						response = bp.unpack('>2HL', chunk)
						server_say('>2HL',response);
						state   = response[0]
						version = response[1]
						length  = response[2]
						content = chunk.slice(8)
					}
					else {
						client_say('received following the response ');
						content = ConcatBuffer(content, chunk)
					}
					if (content.length >= length) {
						client_say('processing the response', state, version, client_ver);
						
						if (state == SphinxClient.SEARCHD_WARNING) {
							var wend = 4 + bp.unpack('>L', content),
							warning = content.slice(4, wend);
							// TODO do something with the warning !!!
						}
						else if (state == SphinxClient.SEARCHD_ERROR) {
							fn(new Error('searchd error: '+content.slice(4).toString()))
						}
						else if (state == SphinxClient.SEARCHD_RETRY) {
							fn(new Error('temporary searchd error: '+content.slice(4).toString()))
						}
						else if (state != SphinxClient.SEARCHD_OK) {
							fn(new Error('unknown status code '+state))
						}

						if (version < client_ver) {
							var warning = util.format('searchd command v.%d.%d older than client\'s v.%d.%d, some options might not work',
								version>>8, version&0xff, client_ver>>8, client_ver&0xff)
							// TODO do something with the warning !!!
						}

						fn(null, content.toString())
					}
			});
				client_say('sending a request');
			client.write(request);
	});
	client.on('end', function() {
			client_say('disconnected');
	});
	client.on('error', function(err) {
			fn(new Error('searchd connexion error'))
	});
	client.write(bp.pack('>L', 1))
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
	if (typeof host == 'string')
		this._host = host;
	if (typeof port == 'number')
		this._port = port;
};
SphinxClient.prototype.SetConnectTimeout = function(timeout ) {
	if (typeof timeout == 'float')
		_timeout = Math.max(0.001, timeout);
};
SphinxClient.prototype.SetLimits = function(offset, limit, maxmatches, cutoff) {
	if (maxmatches == undefined) maxmatches = 0;
	if (cutoff == undefined) cutoff = 0;
};
SphinxClient.prototype.SetMaxQueryTime = function(maxquerytime) {
};
SphinxClient.prototype.SetMatchMode = function(mode) {
};
SphinxClient.prototype.SetRankingMode = function(ranker, rankexpr) {
	if (rankexpr == undefined) rankexpr = '';
};
SphinxClient.prototype.SetSortMode = function(mode, clause) {
	if (clause == undefined) clause = '';
};
SphinxClient.prototype.SetWeights = function(weights) {
};
SphinxClient.prototype.SetFieldWeights = function(weights) {
};
SphinxClient.prototype.SetIndexWeights = function(weights) {
};
SphinxClient.prototype.SetIDRange = function(minid, maxid) {
};
SphinxClient.prototype.SetFilter = function(attribute, values, exclude) {
	if (exclude == undefined) exclude = 0;
};
SphinxClient.prototype.SetGeoAnchor = function(attrlat, attrlong, latitude, longitude) {
};
SphinxClient.prototype.SetGroupBy = function(attribute, func, groupsort ) {
	if (groupsort == undefined) groupsort = '@group desc';
};
SphinxClient.prototype.SetGroupDistinct = function(attribute) {
};
SphinxClient.prototype.SetRetries = function(count, delay) {
	if (delay == undefined) delay = 0;
};
SphinxClient.prototype.SetOverride = function(name, type, values) {
};
SphinxClient.prototype.SetSelect = function(select) {
};
SphinxClient.prototype.ResetOverrides = function() {
};
SphinxClient.prototype.ResetFilters = function() {
};
SphinxClient.prototype.ResetGroupBy = function() {
};
SphinxClient.prototype.Query = function(query, index, comment) {
	if (index == undefined) index = '*';
	if (comment == undefined) comment = '';
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
	req.push(bp.pack('>4L', this._offset, this._limit, this._mode, this._ranker))
	if (this._ranker == SphinxClient.SPH_RANK_EXPR) {
		req.push(bp.pack('>L', this._rankexpr.length))
		req.push(this._rankexpr)
	}
	req.push(bp.pack('>L', this._sort))
	req.push(bp.pack('>L', this._sortby.length))
	req.push(this._sortby)

	// TODO : check if query is encoding in utf8

	req.push(bp.pack('>L', query.length))
	req.push(query)

	req.push(bp.pack('>L', this._weights.length))
	this._weights.forEach(function(item, index) {
			req.push(bp.pack('>L', w))
	});
	req.push(bp.pack('>L', index.length))
	req.push(index)
	req.push(bp.pack('>L', 1)) // id64 range marker
	req.push(bp.pack('>Q', this._min_id))
	req.push(bp.pack('>Q', this._max_id))

	// filters
	req.push(bp.pack('>L', this._filters.length))
	/*
	this._filters.forEach(function(item, index) {
			req.push(bp.pack ( '>L', f['attr']).length + f['attr'])
			filtertype = f['type']
			req.push(bp.pack ( '>L', filtertype))
			if filtertype == SPH_FILTER_VALUES:
				req.push(bp.pack ('>L', len(f['values'])))
				for val in f['values']:
					req.push(bp.pack ('>q', val))
			elif filtertype == SPH_FILTER_RANGE:
				req.push(bp.pack ('>2q', f['min'], f['max']))
			elif filtertype == SPH_FILTER_FLOATRANGE:
				req.push(bp.pack ('>2f', f['min'], f['max']))
			req.append(bp.pack ( '>L', f['exclude'] ) )
		});
		*/

	// group-by, max-matches, group-sort
	req.push(bp.pack('>2L', this._groupfunc, this._groupby.length))
	req.push(this._groupby)
	req.push(bp.pack('>2L', this._maxmatches, this._groupsort.length))
	req.push(this._groupsort)
	req.push(bp.pack('>LLL', this._cutoff, this._retrycount, this._retrydelay)) 
	req.push(bp.pack('>L', this._groupdistinct.length))
	req.push(this._groupdistinct)


};
SphinxClient.prototype.RunQueries = function() {
	result = {};
	return result;
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
	request = bp.pack( '>2HLL', [SphinxClient.SEARCHD_COMMAND_STATUS, SphinxClient.VER_COMMAND_STATUS, 4, 1])
	this._SetRequest(SphinxClient.VER_COMMAND_STATUS, request, function(response) {
			fn(response);
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
