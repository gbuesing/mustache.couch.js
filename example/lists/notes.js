function(head, req) {
  var template = require('vendor/mustache.couch').compile(this, 'notes', 
    {rows_tag: 'notes', rows_only: req.query.rows_only}
  );
  
  template.stream({title: 'Notes', update_seq: req.info.update_seq}, function(row) {
    var doc = row.value;
    doc.key = JSON.stringify(row.key);
    return doc;
  });
}
