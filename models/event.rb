# Model for events
class Event
  include Neo4j::ActiveNode

  property :name, index: :exact
  property :description

  validates :title, presence: true
  validates :description, presence: true
end
