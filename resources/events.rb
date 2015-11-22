module Resources
  class Events < Sinatra::Base
    get '/events' do
      if params.key? 'tag'
        @events = Tag.where(name: params['tag']).events_with_tag
      else
        @events = Event.all
      end

      jbuilder :events
    end
  end
end
