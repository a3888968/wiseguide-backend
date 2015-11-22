Bundler.require

require './db/session'

require './models/event'
require './models/tag'

require './resources/events'

class WiseguideApi < Sinatra::Base
  use Resources::Events
end

use WiseguideApi
