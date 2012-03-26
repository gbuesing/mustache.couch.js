 /*
 * jquery.couch.listchanges.js
 * A helper for using the CouchDB changes feed to update HTML views rendered from list funs
 *
 * Plays well with mustache.couch.js for server-side list fun HTML rendering:
 * http://github.com/gbuesing/mustache.couch.js
 *
 * Copyright 2011, Geoff Buesing
 * Licensed under the MIT license: http://www.opensource.org/licenses/mit-license.php
 *
 * Example:
 *
 *   <ul data-update-type="newRows" data-update-seq="12345">
 *     <li data-key="key">Foo</li>
 *   </ul>
 *
 *   <script>
 *      $('ul').listChanges();
 *   </script>
 *
 * When data-update-type="allRows", inner html of container element will be replaced with returned rows.
 *
 * When data-update-type="newRows", startkey/endkey will be adjusted to return only updated rows. 
 * New rows will be prepended or appended to the container as appropriate with the value of the 
 * descending querystring var.
 *
 * When data-update-type="latestRows", startkey/endkey will be adjusted to return only the high key row *and*
 * any rows that have been added since the last change was received. The returned HTML will replace the
 * existing high key row in the DOM. This updateType is useful for updating a table of daily totals, where only
 * the current day's total will change.
 *
 * "newRows" and "latestRows" requires embedding the row key in each row in a data-key attribute.
 *
 * The update_seq can optionally be specified in the data-update-seq attribute; this will save a call to
 * retrieve the update_seq via Ajax after the page has loaded.
 *
 * The list fun needs to return the entire page for a standard request, and just the templated rows
 * for XHR requests (rows_only=true is appended to the XHR querystring as a convenience.)
 *
 * See https://github.com/gbuesing/mustache.couch.js/tree/master/example
*/
(function( $ ){
  
  $.fn.listChanges = function(opts) {
    return this.each(function() {
      listChanges($(this), opts || {});
    });
  }
  
  function listChanges(container, opts) {
    var updateSeq = opts.updateSeq || container.attr('data-update-seq');
    var updateType = opts.updateType || container.attr('data-update-type') || 'allRows';
    var explicitUrl = opts.url || container.attr('data-url');
    var preload = !!explicitUrl;
    var url = explicitUrl || window.location.pathname + window.location.search;
    var urlParts = url.split('?');
    var urlPath = urlParts[0];
    var params = getParams(urlParts[1]);
    var db = opts.db || urlPath.split('/')[1];    
    params.rows_only = true;
    var descending = opts.descending || (params.descending === 'true') || container.attr('data-descending');
    var xhr, inFlight = false, queued = false;
    
    var queryForUpdates = function() {
      if (inFlight) {
        queued = true; 
        return;
      };
      inFlight = true;
      var highkeyElem, containerUpdateMethod = 'html';
      
      if (updateType === 'newRows' || updateType === 'latestRows') {
        containerUpdateMethod = descending ? 'prepend' : 'append';
        highkeyElem = descending ? container.children('[data-key]:first') : container.children('[data-key]:last');
        if (highkeyElem) { updateParamsForNewRowsQuery(params, highkeyElem, descending, updateType) };
      }
      
      xhr = $.ajax({
        type: 'GET',
        url: urlPath,
        data: params,
        dataType: 'html',
        cache: false,
        success: function(data) {
          if (data && data.match(/\S/)) {
            if (updateType === 'latestRows' && highkeyElem) {
              highkeyElem.replaceWith(data);
            } else {
              container[containerUpdateMethod](data);
            }
            
            if (opts.success) {
              var newRows;
              if (highkeyElem) { newRows = descending ? highkeyElem.prevAll() : highkeyElem.nextAll() };
              opts.success(newRows);
            }
          }
          inFlight = false;
          if (queued) {
            queued = false;
            container.trigger('update');
          };
        },
        error: function() {
          inFlight = false;
        }
      });
    }
    
    container.bind('update.listChanges', queryForUpdates);
    
    if (preload) { container.trigger('update') };
    
    var changes = $.couch.db(db).changes(updateSeq, opts.changesOpts);
    changes.onChange(function() {
      container.trigger('update');
    });
    container.data('changes', changes);
    
    container.bind('stop.listChanges', function() {
      changes.stop();
      if (xhr) { xhr.abort() };
      container.removeData('changes');
      container.unbind('.listChanges');
    });
  }
  
  // helper funs
  function getParams(querystring) {
    var params = {};
    if (querystring.length > 1) {  
      for (var aItKey, nKeyId = 0, aCouples = querystring.split("&"); nKeyId < aCouples.length; nKeyId++) {  
        aItKey = aCouples[nKeyId].split("=");  
        params[unescape(aItKey[0])] = aItKey.length > 1 ? unescape(aItKey[1]) : null;  
      }  
    }
    return params;
  }
  
  function updateParamsForNewRowsQuery(params, highkeyElem, descending, updateType) {
    var highkey = highkeyElem.attr('data-key');
    var highkey_docid = highkeyElem.attr('data-docid');
    
    if (!highkey) { return };
    
    delete params.limit;
    
    if (descending) {
      params.endkey = highkey;
      if (updateType === 'newRows') { params.inclusive_end = false };
      if (highkey_docid) { params.endkey_docid = highkey_docid };
      delete params.startkey;
    } else {
      params.startkey = highkey;
      if (updateType === 'newRows') { params.skip = 1 };
      if (highkey_docid) { params.startkey_docid = highkey_docid };
      delete params.endkey;
    }
  }
})( jQuery );
