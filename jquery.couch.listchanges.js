/*
 * jquery.couch.listchanges.js
 * A helper for using the CouchDB changes feed to update HTML views rendered from list funs
 *
 * Plays well with mustache.couch.js for server-side list fun rendering:
 * http://github.com/gbuesing/mustache.couch.js
 *
 * Copyright 2011, Geoff Buesing
 * Licensed under the MIT license: http://www.opensource.org/licenses/mit-license.php
 *
 * Example:
 *
 *   <ul data-changes="newRows" data-update-seq="12345">
 *     <li data-key="key">Foo</li>
 *   </ul>
 *
 *   <script>
 *      $('ul').listChanges();
 *   </script>
 *
 * When data-changes="true", inner html of container element will be replaced with returned rows.
 * When data-changes="newRows", new rows will be prepended or appended to the container
 * as appropriate with the value of the descending querystring var.
 * "newRows" requires embedding the row key in each row in a data-key attribute.
 *
 * The list fun needs to return the entire page for a standard request, and just the templated rows
 * for XHR requests (rows_only=true is appended to the XHR querystring as a convenience.)
 *
 * Note that this library only works when view params are in the querystring - rewritten urls may not work.
 *
 * See https://github.com/gbuesing/mustache.couch.js/tree/master/example
*/
(function( $ ){
  $.fn.listChanges = function(opts) {
    opts = opts || {};
    var container = this.eq(0);
    var update_seq = opts.update_seq || container.attr('data-update-seq');
    var type = opts.type || container.attr('data-changes');
    var dbname = unescape(window.location.pathname.split('/')[1]);
    var params = getQueryParams();
    params.rows_only = true;
    
    var queryForUpdates = function(cb) {
      var containerUpdateMethod = 'html';
      
      if (type === 'newRows') {
        delete params.limit;
        
        var highkeyElem = params.descending ? container.children('[data-key]:first') : container.children('[data-key]:last');
        var highkey = highkeyElem.attr('data-key');
        var highkey_docid = highkeyElem.attr('data-docid');

        if (params.descending) {
          containerUpdateMethod = 'prepend';
          
          if (highkey) {
            params.endkey = highkey;
            params.inclusive_end = false;
            if (highkey_docid) { params.endkey_docid = highkey_docid };
            delete params.startkey;
          }
        } else {
          containerUpdateMethod = 'append';
          
          if (highkey) { 
            params.startkey = highkey;
            params.skip = 1;
            if (highkey_docid) { params.startkey_docid = highkey_docid };
            delete params.endkey;
          }
        }
      }
      
      $.ajax({
        type: 'GET',
        url: window.location.pathname,
        data: params,
        dataType: 'html',
        success: function(data) {
          if (data !== '') {
            var elem = $(data);
            container[containerUpdateMethod](elem);
            if (opts.success) { opts.success(elem, type) };
          }
        },
        complete: cb()
      });
    }
    
    var inFlight = false;

    $.couch.db(dbname).changes(update_seq).onChange(function() {
      // inFlight guard ensures only one queryForUpdates request at a time
      if (inFlight) { return };
      inFlight = true;
      queryForUpdates(function() { inFlight = false });
    });
    
    return container;
  }
  
  // helper fun
  function getQueryParams() {
    var params = {};
    if (window.location.search.length > 1) {  
      for (var aItKey, nKeyId = 0, aCouples = window.location.search.substr(1).split("&"); nKeyId < aCouples.length; nKeyId++) {  
        aItKey = aCouples[nKeyId].split("=");  
        params[unescape(aItKey[0])] = aItKey.length > 1 ? unescape(aItKey[1]) : null;  
      }  
    }
    return params;
  }
})( jQuery );
