require_relative 'session'

query_string = <<query
  create
  (_1:Event  {id: 1, name: "Nicolas Jaar & Valentine Stip", description: "abc"}),
  (_2:Event  {id: 2, name: "Late Nite Tuff Guy", description: "def"}),
  (_3:Event  {id: 3, name: "Diynamic Music Showcase", description: "ghi"})
query

Neo4j::Session.current.query(query_string)
