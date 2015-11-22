class Tag
  include Neo4j::ActiveNode

  property :name, index: :exact

  has_many :in, :events_with_tag, model_class: :Event, type: :HAS_TAG
end
