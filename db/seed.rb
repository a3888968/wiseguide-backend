require_relative 'session'

query_string = <<query
  create
  (_1:Event {id: 1, name: "Nicolas Jaar & Valentine Stip", description: "abc"}),
  (_2:Event {id: 2, name: "Late Nite Tuff Guy", description: "def"}),
  (_3:Event {id: 3, name: "Some Photography", description: "ghi"}),
  (_4:Tag   {id: 4, name: "music"}),
  (_5:Tag   {id: 5, name: "photography"}),
  _1-[:HAS_TAG]->_4,
  _2-[:HAS_TAG]->_4,
  _3-[:HAS_TAG]->_5
query

Neo4j::Session.current.query(query_string)
