module Resources
  # API endpoints pertaining to updating and fetching event information
  class Events < Sinatra::Base
    get '/events' do
      @events = Event.all

      jbuilder :events
    end
  end
end
