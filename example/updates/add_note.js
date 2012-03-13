function(doc, req) {
  var note = req.form.note;
  
  if (note) {
    var doc = {
      _id: req.uuid,
      note: note, 
      created_at: new Date()
    };
    
    return [doc, 'OK'];
  };
}