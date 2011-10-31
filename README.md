# mustache.couch.js
A helper for streaming Mustache templates from CouchDB list functions.

## Server-Side Templating Is Fast

When you stream out fully templated rows to the client, the user starts seeing content immediately.

Compare this to client-side templating, which doesn't present content as it streams in -- you need to receive an entire JSON response before you can eval it, template it, and then add it to the DOM. If you're presenting hundreds or thousands of rows, there will be a long delay before the user sees any content.

## Basic Example

Assuming a [CouchApp](http://couchapp.org/) filesystem mapping for your design doc:

Put mustache.couch.js and the CommonJS build of [mustache.js](http://github.com/janl/mustache.js) somewhere in your design doc tree (a vendor/ subdirectory is a good place for them.)

Templates need to be included in a templates/ subdirectory of your design doc. The portion of the template that will be rendered for each row needs to be between a matching set of ```<!-- %ROWS -->``` comments.

Example template: ```mycouchapp/templates/notes.html```

```html
<h1>{{title}}</h1>

<table>
  <!-- %ROWS -->
  <tr>
    <td>{{note}}</td>
    <td>{{created_at}}</td>
  </tr>
  <!-- %ROWS -->
</table>
```

Inside list functions, you compile the template by passing in the design doc (```this``` in this context) and the name of the template. 

You then call stream() on the template, passing in the base data for the outer template, and a callback that's called for each row returned from the view, which should return the data for each HTML table row.

Example: ```mycouchapp/lists/notes.js```

```javascript
function(head, req) {
  var template = require('vendor/mustache.couch').compile(this, 'notes');

  template.stream({title: 'Notes'}, function(row) {
    return row.doc;
  });
}
```

When you navigate to the this list function in a browser (e.g., ```_list/notes/someview?include_docs=true```), the posts.html template will be streamed: first the start of the template is sent, then each table row, then the end of the template.

Content-Type will be automatically set to "text/html; charset=utf-8" instead of the CouchDB default of "application/json".

## Layouts

Templates can optionally be wrapped in a layout. Template content will be inserted in place of the ```<!-- %YIELD -->``` comment in the layout.

Example layout: ```mycouchapp/templates/layout.html```

```html
<!DOCTYPE html>
<html>
  <head>
    <title>{{title}} - MyCouchApp</title>
  </head>
  <body>
    <!-- %YIELD -->
  </body>
</html>
```
    
If a layout.html file exists in the templates directory, all templates will automatically be wrapped in the layout *unless* this option is explicitly overridden in the compile() function:
    
```javascript
// template will *not* be wrapped in layout
var template = require('vendor/mustache.couch').compile(this, 'notes', {layout: null});
```
    
Or, a different layout can be specified:

```javascript
// will wrap template in layout at mycouchapp/templates/admin.html
var template = require('vendor/mustache.couch').compile(this, 'notes', {layout: 'admin'});
```
    
The layout *and* the area outside of the row template can be skipped via the ```rows_only``` option (useful when you're doing an ajax refresh of page content):

```javascript
var template = require('vendor/mustache.couch').compile(this, 'notes', {rows_only: true});
```

## Row Rendering

As show above, the row callback returns the data used for each rendering of the template inside the ```<!-- %ROWS -->``` comments. Inside the row template, the data supplied as the first argument to stream() is accessible as well, with values from the row callback taking precedence.

The row callback is called with two arguments -- the row returned from getRow(), and the current row count. You can use the row count to detect if you need to show pagination in the template:

```javascript
var data = {};
template.stream(data, function(row, i) {
  if (i == req.query.limit) { data.show_pagination = true };
  return row.doc;
});
```

If the row callback returns a false-y value (```false```, ```null```, ```undefined```, or doesn't return at all), the row template won't be rendered for this row. This is useful if you want to build up an HTML table row with the values from multiple view rows.

The row callback is optional -- when no row callback is supplied to stream(), the default callback is used, which just returns the row. This is sufficient if you're just showing the keys and values from, say, a reduce query.

## Pagination

As a convenience, mustache.couch.js renders the foot of the template with two additional values: ```lastkey``` and ```lastkey_docid```. Values are the key and id of the last row returned from the view, stringified and URI encoded, for use in "more results"-style pagination links at the bottom of the page, e.g.:
    
```html
<p><a href="?include_docs=true&startkey={{{lastkey}}}&limit=100&skip=1">More...</a></p>
```

## HTTP Headers

Additional HTTP headers can be added to the response via the headers object on the template:

```javascript
function(head, req) {
  var template = require('vendor/mustache.couch').compile(this, 'notes');
  template.headers['X-Foo'] = 'bar';
  template.stream({title: "Notes"});
}
```

## Mustache Partials

Mustache partials can be specified via the partials object on the template:

```javascript
function(head, req) {
  var template = require('vendor/mustache.couch').compile(this, 'notes');
  template.partials['sidebar'] = "<h2>Sidebar for {{title}}<h2>";
  template.stream({title: "Notes"});
}
```

## Show Functions

mustache.couch.js can also be used inside show functions, via the show() function on the template.

```javascript
function(doc, req) {
  var template = require('lib/mustache.couch').compile(this, 'note');

  template.show(doc);
}
```

Note that show functions don't support response streaming (the view server buffers the output.)

## A Warning About CouchDB 1.1.0 ETag Bug

CouchDB 1.1.0 shipped with a bug in ETag generation for views: updates to docs included in views won't update the ETag supplied with the view. So if you do an ?include_docs=true query with conditional get, Couch 1.1.0 will return a 304 Not Modified, even if the docs have changed.

Google Chrome appears to be doing conditional get by default; you can work around this by adding a timestamped param to the querystring.

This bug has been fixed in CouchDB 1.1.1.

## License

mustache.couch.js is copyright (c) 2011 Geoff Buesing and distributed under the MIT license. See the LICENSE file for more info.