class Event
  include Neo4j::ActiveNode

  property :name, index: :exact
  property :description

  validates :name, presence: true
  validates :description, presence: true

  has_many :out, :tags, model_class: :Tag, type: :HAS_TAG
end
