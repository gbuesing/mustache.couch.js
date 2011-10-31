function(head, req) {
  var template = require('vendor/mustache.couch').compile(this, 'notes');
  
  template.stream({title: 'Notes'}, function(row) {
    return row.doc;
  });
}
