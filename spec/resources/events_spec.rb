require './resources/events'

describe Resources::Events do
  let(:result) { get url }
  let(:body)   { JSON.parse(result.body, symbolize_names: true) }

  describe '/events' do
    let(:url) { '/events' }

    let(:all_events) do
      [
        double(name: 'Event 1', description: 'Description 1'),
        double(name: 'Event 2', description: 'Description 2'),
        double(name: 'Event 3', description: 'Description 3')
      ]
    end

    before do
      allow(Event).to receive(:all).and_return(all_events)
    end

    it 'returns the list of events and descriptions' do
      expect(body).to eq events: [
        { name: 'Event 1', description: 'Description 1' },
        { name: 'Event 2', description: 'Description 2' },
        { name: 'Event 3', description: 'Description 3' }
      ]
    end
  end
end
