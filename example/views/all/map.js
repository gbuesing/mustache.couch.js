function(doc) {
  emit(doc.created_at, doc);
}