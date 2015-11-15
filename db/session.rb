require 'Neo4j'

Neo4j::Session.open(
  :server_db,
  ENV.fetch('NEO4J_URL'),
  basic_auth: { username: ENV.fetch('NEO4J_USERNAME'), password: ENV.fetch('NEO4J_PASSWORD') }
)
