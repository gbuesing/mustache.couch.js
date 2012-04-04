/*
 * mustache.couch.js: a helper for streaming Mustache templates from CouchDB list functions
 * http://github.com/gbuesing/mustache.couch.js
 *
 * Copyright 2011, Geoff Buesing
 * Licensed under the MIT license: http://www.opensource.org/licenses/mit-license.php
 *
 * Requires the CommonJS build of mustache.js
 * http://github.com/janl/mustache.js
*/
var Mustache = require('./mustache');


// public api
exports.compile = function(ddoc, templateName, opts) {
  var template = compileTemplate(ddoc, templateName, opts);

  return {
    headers: {"Content-Type": "text/html; charset=utf-8"},
    
    partials: {},
    
    stream: function(data, rowCb) {
      start({headers: this.headers});
      template.stream(data, this.partials, rowCb);
    },
    
    show: function(data) {
      start(this.headers);
      template.show(data, this.partials);
    }
  }
}


// helper funs...

function compileTemplate(ddoc, templateName, opts) {
  opts = opts || {};
  var sections = extractTemplateSections(ddoc, templateName, opts)

  return {
    stream: function(data, partials, rowCb) {
      if (!opts.rows_only) {
        render(sections.header, data, partials);
      }

      var lastRow;
      if (sections.row) {
        lastRow = renderRows(sections.row, data, partials, rowCb);
      }

      if (!opts.rows_only) {
        if (lastRow) {
          data.lastkey = encodeURIComponent(JSON.stringify(lastRow.key));
          data.lastkey_docid = encodeURIComponent(lastRow.id);
        }
        render(sections.footer, data, partials);
      }
    },
    show: function(data, partials) {
      render(sections.joined(), data, partials);
    }
  }
}

function extractTemplateSections(ddoc, templateName, opts) {
  // find template files
  var layoutHTML = opts.skip_layout ? '' : ddoc.templates[opts.layout || 'layout'];
  var templateHTML = ddoc.templates[templateName];
  
  // split into parts
  var layoutSeparator = '{{{' + (opts.layout_tag || 'yield')  + '}}}';
  var layoutParts = (layoutHTML || '').split(layoutSeparator, 2);

  var templateSeparator = new RegExp('{{[#/]' + (opts.rows_tag || 'rows')  + '}}');
  var templateParts = templateHTML.split(templateSeparator, 3);

  return {
    header: [layoutParts[0], templateParts[0]].join(''),
    row: templateParts[1],
    footer: [templateParts[2], layoutParts[1]].join(''),
    joined: function() {
      return [this.header, this.row, this.footer].join('');
    }
  }
}

function render(template, data, partials) {
  send(Mustache.to_html(template, data, partials));
}

function renderRows(template, data, partials, rowCb) {
  rowCb = rowCb || defaultRowCb;
  var row, rowData, lastRow, count = 0;
  
  while(row = getRow()) {
    count ++;
  
    if (rowData = rowCb(row, count)) {
      if (rowData === 'stop') break;
      render(template, mergeData(data, rowData), partials);
      lastRow = row;
    }
  }
  
  return lastRow;
}

function defaultRowCb(row, count) { 
  return row;
}

function mergeData(data, rowData) {
  for (var prop in data) {
    if (data.hasOwnProperty(prop) && !rowData.hasOwnProperty(prop)) {
      rowData[prop] = data[prop];
    }
  }
  return rowData;
}
