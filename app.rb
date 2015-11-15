Bundler.require

require './db/session'

require './models/event'

require './resources/events'

# API endpoints for the WiseGuide application
class WiseguideApi < Sinatra::Base
  use Resources::Events
end

use WiseguideApi
