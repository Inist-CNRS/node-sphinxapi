# Sphinx Search Client for NodeJS

It's native javascript implementation of the standard Sphinx API. The API is totaly similar with the others API clients 
implementation. It's also respects NodeJS code convention.

# Installation

coming soon ...


# Examples

coming soon ...


# API Documentation

from the official documentation : http://sphinxsearch.com/docs/current.html#api-reference
## [![Porting Status](./raw/master/rouge.png)] GetLastError() 
## [![Porting Status](./raw/master/rouge.png)] GetLastWarning() 
## [![Porting Status](./raw/master/vert.png)] SetServer (String host, Integer port) 
## [![Porting Status](./raw/master/rouge.png)] SetConnectTimeout (timeout) 
## [![Porting Status](./raw/master/rouge.png)] SetLimits (offset, limit, maxmatches, cutoff) 
## [![Porting Status](./raw/master/rouge.png)] SetMaxQueryTime (maxquerytime) 
## [![Porting Status](./raw/master/rouge.png)] SetMatchMode (mode) 
## [![Porting Status](./raw/master/rouge.png)] SetRankingMode (ranker, rankexpr) 
## [![Porting Status](./raw/master/rouge.png)] SetSortMode (mode, clause) 
## [![Porting Status](./raw/master/rouge.png)] SetWeights (weights) 
## [![Porting Status](./raw/master/rouge.png)] SetFieldWeights (weights) 
## [![Porting Status](./raw/master/rouge.png)] SetIndexWeights (weights) 
## [![Porting Status](./raw/master/rouge.png)] SetIDRange (minid, maxid) 
## [![Porting Status](./raw/master/rouge.png)] SetFilter (attribute, values, exclude) 
## [![Porting Status](./raw/master/rouge.png)] SetGeoAnchor (attrlat, attrlong, latitude, longitude) 
## [![Porting Status](./raw/master/rouge.png)] SetGroupBy (attribute, func, groupsort ) 
## [![Porting Status](./raw/master/rouge.png)] SetGroupDistinct (attribute) 
## [![Porting Status](./raw/master/rouge.png)] SetRetries (count, delay) 
## [![Porting Status](./raw/master/rouge.png)] SetOverride (name, type, values) 
## [![Porting Status](./raw/master/rouge.png)] SetSelect (select) 
## [![Porting Status](./raw/master/rouge.png)] ResetOverrides () 
## [![Porting Status](./raw/master/rouge.png)] ResetFilters () 
## [![Porting Status](./raw/master/rouge.png)] ResetGroupBy () 
## [![Porting Status](./raw/master/orange.png)] Query (query, index, comment, fn) 
## [![Porting Status](./raw/master/orange.png)] AddQuery (query, index, comment) 
## [![Porting Status](./raw/master/orange.png)] RunQueries (fn) 
## [![Porting Status](./raw/master/rouge.png)] BuildExcerpts (docs, index, words, opts) 
## [![Porting Status](./raw/master/rouge.png)] UpdateAttributes (index, attrs, values, mva) 
## [![Porting Status](./raw/master/rouge.png)] BuildKeywords (query, index, hits ) 
## [![Porting Status](./raw/master/vert.png)] Status (fn) 
## [![Porting Status](./raw/master/rouge.png)] Open () 
## [![Porting Status](./raw/master/rouge.png)] Close () 
## [![Porting Status](./raw/master/rouge.png)] EscapeString (string)
## [![Porting Status](./raw/master/rouge.png)] FlushAttributes () 


# Also

* https://github.com/kurokikaze/limestone

# License

[MIT/X11](./LICENSE)

