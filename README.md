# Sphinx Search Client for NodeJS

It's native javascript implementation of the standard Sphinx API. The API is totaly similar with the others API clients 
implementation. It's also respects NodeJS code convention.

# Installation

coming soon ...


# Examples

coming soon ...


# API Documentation

from the official documentation : http://sphinxsearch.com/docs/current.html#api-reference

## [![Porting Status](./rouge.png)] GetLastError() 
## [![Porting Status](./rouge.png)] GetLastWarning() 
## [![Porting Status](./vert.png)] SetServer (String host, Integer port) 
## [![Porting Status](./rouge.png)] SetConnectTimeout (timeout) 
## [![Porting Status](./rouge.png)] SetLimits (offset, limit, maxmatches, cutoff) 
## [![Porting Status](./rouge.png)] SetMaxQueryTime (maxquerytime) 
## [![Porting Status](./rouge.png)] SetMatchMode (mode) 
## [![Porting Status](./rouge.png)] SetRankingMode (ranker, rankexpr) 
## [![Porting Status](./rouge.png)] SetSortMode (mode, clause) 
## [![Porting Status](./rouge.png)] SetWeights (weights) 
## [![Porting Status](./rouge.png)] SetFieldWeights (weights) 
## [![Porting Status](./rouge.png)] SetIndexWeights (weights) 
## [![Porting Status](./rouge.png)] SetIDRange (minid, maxid) 
## [![Porting Status](./rouge.png)] SetFilter (attribute, values, exclude) 
## [![Porting Status](./rouge.png)] SetGeoAnchor (attrlat, attrlong, latitude, longitude) 
## [![Porting Status](./rouge.png)] SetGroupBy (attribute, func, groupsort ) 
## [![Porting Status](./rouge.png)] SetGroupDistinct (attribute) 
## [![Porting Status](./rouge.png)] SetRetries (count, delay) 
## [![Porting Status](./rouge.png)] SetOverride (name, type, values) 
## [![Porting Status](./rouge.png)] SetSelect (select) 
## [![Porting Status](./rouge.png)] ResetOverrides () 
## [![Porting Status](./rouge.png)] ResetFilters () 
## [![Porting Status](./rouge.png)] ResetGroupBy () 
## [![Porting Status](./orange.png)] Query (query, index, comment, fn) 
## [![Porting Status](./orange.png)] AddQuery (query, index, comment) 
## [![Porting Status](./orange.png)] RunQueries (fn) 
## [![Porting Status](./rouge.png)] BuildExcerpts (docs, index, words, opts) 
## [![Porting Status](./rouge.png)] UpdateAttributes (index, attrs, values, mva) 
## [![Porting Status](./rouge.png)] BuildKeywords (query, index, hits ) 
## [![Porting Status](./vert.png)] Status (fn) 
## [![Porting Status](./rouge.png)] Open () 
## [![Porting Status](./rouge.png)] Close () 
## [![Porting Status](./rouge.png)] EscapeString (string)
## [![Porting Status](./rouge.png)] FlushAttributes () 


# Also

* https://github.com/kurokikaze/limestone

# License

[MIT/X11](./LICENSE)

