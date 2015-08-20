'use strict';

var _ = require('lodash'),
    async = require('async'),
    main = require('./main'),
    jsonContentTypeRegex = main.jsonContentTypeRegex,
    moduleUsers = require('./users'),
    moduleSystem = require('./system'),
    moduleVenues = require('./venues'),
    moduleCategories = require('./categories');



var generateEvent = (function() {
    var count = 0;

    return function(cats, venuesAndRooms) {
        var validEvent = {
            Name: "Event " + count++,
            Categories: cats,
            Description: "A description",
            Occurrences: []
        };
        for (var i = 0; i < venuesAndRooms.length; i++) {
            validEvent.Occurrences.push({
                Start: new Date().getTime() + _.random(0, 86400),
                End: new Date().getTime() + _.random(86401, 172800),
                VenueId: venuesAndRooms[i].VenueId,
                Room: venuesAndRooms[i].Room
            });
        }
        return validEvent;
    };
})();


describe('/api/events', function() {

    var contributor = moduleUsers.generateUser(),
        contributorToken,
        venues = [{
            Id: null,
            Venue: moduleVenues.generateVenueRandomised()
        }, {
            Id: null,
            Venue: moduleVenues.generateVenueRandomised()
        }, {
            Id: null,
            Venue: moduleVenues.generateVenueRandomised()
        }],
        cats = ["cat1", "cat2", "cat3"];

    before(function(done) {
        moduleUsers.signupUser(contributor, function(err, result) {
            if (err) return done(err);
            contributorToken = result.Token;
            async.eachSeries(venues, function(v, cb) {
                moduleVenues.createVenue(v.Venue, contributorToken, function(err, venueId) {
                    if (err) return cb(err);
                    v.Id = venueId;
                    cb();
                });
            }, function(err) {
                if (err) done(err);
                async.eachSeries(cats, function(cat, cb) {
                    moduleCategories.makeCreateCategoryRequest(cat, main.adminToken)
                        .expect(200, cb);
                }, done);
            });
        });
    });

    describe('/create', function() {
        ['admin', 'contributor'].forEach(function(role) {
            var isAdmin = role === 'admin';

            it('should return 200 response and event ID for valid events (' + role + ')', function(done) {
                // try events with empty categories, single category, multiple categories, 
                // single occurrence, multiple occurrences (include same/different venues and same/different rooms)
                var validEvents = [
                    generateEvent([], [{
                        VenueId: venues[0].Id,
                        Room: venues[0].Venue.Rooms[0]
                    }]),
                    generateEvent(cats, [{
                        VenueId: venues[0].Id,
                        Room: venues[0].Venue.Rooms[0]
                    }]),
                    generateEvent([cats[0]], [{
                        VenueId: venues[0].Id,
                        Room: venues[0].Venue.Rooms[0]
                    }]),
                    generateEvent([cats[1]], [{
                        VenueId: venues[0].Id,
                        Room: venues[0].Venue.Rooms[0]
                    }, {
                        VenueId: venues[0].Id,
                        Room: venues[0].Venue.Rooms[0]
                    }]),
                    generateEvent([cats[1]], [{
                        VenueId: venues[0].Id,
                        Room: venues[0].Venue.Rooms[0]
                    }, {
                        VenueId: venues[0].Id,
                        Room: venues[0].Venue.Rooms[1]
                    }, {
                        VenueId: venues[0].Id,
                        Room: venues[0].Venue.Rooms[2]
                    }]),
                    generateEvent([cats[1]], [{
                        VenueId: venues[0].Id,
                        Room: venues[0].Venue.Rooms[0]
                    }, {
                        VenueId: venues[1].Id,
                        Room: venues[1].Venue.Rooms[0]
                    }, {
                        VenueId: venues[2].Id,
                        Room: venues[2].Venue.Rooms[0]
                    }, {
                        VenueId: venues[2].Id,
                        Room: venues[2].Venue.Rooms[0]
                    }, {
                        VenueId: venues[2].Id,
                        Room: venues[2].Venue.Rooms[0]
                    }])
                ];

                // try pushing the limits of individual properties
                var validEventJson = JSON.stringify(generateEvent(cats, [{
                    VenueId: venues[0].Id,
                    Room: venues[0].Venue.Rooms[0]
                }]));
                var substitutions = [{
                    Property: "Name",
                    Value: _.repeat("a", 3)
                }, {
                    Property: "Name",
                    Value: _.repeat("a", 30)
                }, {
                    Property: "Name",
                    Value: _.repeat("1", 3)
                }, {
                    Property: "Name",
                    Value: _.repeat("1", 30)
                }, {
                    Property: "Name",
                    Value: _.repeat("?", 3)
                }, {
                    Property: "Name",
                    Value: _.repeat("?", 30)
                }, {
                    Property: "Name",
                    Value: _.repeat(";", 3)
                }, {
                    Property: "Name",
                    Value: _.repeat(";", 30)
                }, {
                    Property: "Description",
                    Value: _.repeat("a", 1)
                }, {
                    Property: "Description",
                    Value: _.repeat("a", 3000)
                }, {
                    Property: "Description",
                    Value: _.repeat("1", 1)
                }, {
                    Property: "Description",
                    Value: _.repeat("1", 3000)
                }, {
                    Property: "Description",
                    Value: _.repeat("?", 1)
                }, {
                    Property: "Description",
                    Value: _.repeat("?", 3000)
                }, {
                    Property: "Description",
                    Value: _.repeat(";", 1)
                }, {
                    Property: "Description",
                    Value: _.repeat(";", 3000)
                }, ];
                for (var i = 0; i < substitutions.length; i++) {
                    var validEvent = JSON.parse(validEventJson);
                    validEvent[substitutions[i].Property] = substitutions[i].Value;
                    validEvents.push(validEvent);
                }

                // run all the supposedly valid requests
                async.eachLimit(validEvents, 1, function(ev, cb) {
                    testValidCreateEvent(ev, getToken(isAdmin), cb);
                }, done);
            });

            it('should return 400 response "wrong_content_type" if wrong content type specified (' + role + ')', function(done) {
                main.testWrongContentType("/api/events/create", ['image/jpeg', 'text/plain'], getToken(isAdmin), done);
            });

            it('should return 400 response "invalid_json" if non-JSON body sent (' + role + ')', function(done) {
                main.testInvalidJSON('/api/events/create', '{"Name": "This string doesnt end}', getToken(isAdmin), done);
            });

            it('should return 400 response "invalid_parameters" when a parameter is missing (' + role + ')', function(done) {
                var validEventJson = JSON.stringify(generateEvent(cats, [{
                    VenueId: venues[0].Id,
                    Room: venues[0].Venue.Rooms[0]
                }]));
                var invalidEvents = [];
                var propsToDelete = ["Name", "Categories", "Description", "Occurrences"];
                var ev;

                for (var i = 0; i < propsToDelete.length; i++) {
                    ev = JSON.parse(validEventJson);
                    delete ev[propsToDelete[i]];
                    invalidEvents.push(ev);
                }

                async.eachLimit(invalidEvents, 10, function(ev, cb) {
                    makeCreateEventRequest(ev, getToken(isAdmin))
                        .expect('Content-Type', jsonContentTypeRegex)
                        .expect(400)
                        .expect({
                            Error: "invalid_parameters"
                        }, cb);
                }, done);
            });

            it('should return 400 response "bad_name" when an invalid value is supplied for Name (' + role + ')', function(done) {
                var validEventJson = JSON.stringify(generateEvent(cats, [{
                    VenueId: venues[0].Id,
                    Room: venues[0].Venue.Rooms[0]
                }]));
                var invalidEvents = [];
                var nameValues = ["", null, {},
                    [], 2, _.repeat("a", 31), _.repeat(" ", 31), ["a", "b"], 50.3, {
                        Name: "boo"
                    }
                ];
                var ev;

                for (var i = 0; i < nameValues.length; i++) {
                    ev = JSON.parse(validEventJson);
                    ev.Name = nameValues[i];
                    invalidEvents.push(ev);
                }

                async.eachLimit(invalidEvents, 10, function(ev, cb) {
                    makeCreateEventRequest(ev, getToken(isAdmin))
                        .expect('Content-Type', jsonContentTypeRegex)
                        .expect(400)
                        .expect({
                            Error: "bad_name"
                        }, cb);
                }, done);
            });

            it('should return 400 response "bad_categories" when non-existent or invalid Categories are specified (' + role + ')', function(done) {
                var validEventJson = JSON.stringify(generateEvent(cats, [{
                    VenueId: venues[0].Id,
                    Room: venues[0].Venue.Rooms[0]
                }]));
                var invalidEvents = [];
                var catValues = [
                    ["doesntexist"],
                    ["doesntexist", "nordoi", "neitherdoi"], {}, {
                        Categories: []
                    }, {
                        Categories: 2
                    },
                    "",
                    " ",
                    "notalist"
                ];
                var ev;

                for (var i = 0; i < catValues.length; i++) {
                    ev = JSON.parse(validEventJson);
                    ev.Categories = catValues[i];
                    invalidEvents.push(ev);
                }

                async.eachLimit(invalidEvents, 10, function(ev, cb) {
                    makeCreateEventRequest(ev, getToken(isAdmin))
                        .expect('Content-Type', jsonContentTypeRegex)
                        .expect(400)
                        .expect({
                            Error: "bad_categories"
                        }, cb);
                }, done);
            });

            it('should return 400 response "bad_description" when invalid Description is specified (' + role + ')', function(done) {
                var validEventJson = JSON.stringify(generateEvent(cats, [{
                    VenueId: venues[0].Id,
                    Room: venues[0].Venue.Rooms[0]
                }]));
                var invalidEvents = [];
                var badValues = [
                    "",
                    "   ",
                    _.repeat(" ", 3001),
                    _.repeat("x", 3001), [],
                    ["list", "list2"], {}, {
                        prop: "value"
                    },
                    0, -1,
                    5000,
                    NaN
                ];
                var ev;

                for (var i = 0; i < badValues.length; i++) {
                    ev = JSON.parse(validEventJson);
                    ev.Description = badValues[i];
                    invalidEvents.push(ev);
                }

                async.eachLimit(invalidEvents, 10, function(ev, cb) {
                    makeCreateEventRequest(ev, getToken(isAdmin))
                        .expect('Content-Type', jsonContentTypeRegex)
                        .expect(400)
                        .expect({
                            Error: "bad_description"
                        }, cb);
                }, done);
            });

            it('should return 400 response "bad_occurrences" when invalid Occurrences are specified (' + role + ')', function(done) {
                var validEventJson = JSON.stringify(generateEvent(cats, [{
                    VenueId: venues[0].Id,
                    Room: venues[0].Venue.Rooms[0]
                }]));
                var invalidEvents = [];
                var badValues = [
                    null, [],
                    [1],
                    ["a", "b"],
                    [{}],
                    [{}, {}], {}, {
                        "Start": 1,
                        "End": 100,
                        "VenueId": "a",
                        "Room": "b"
                    },
                    "",
                    " ",
                    1,
                    1.0, [{
                        Start: "string",
                        End: new Date().getTime() + _.random(86401, 172800),
                        VenueId: venues[0].Id,
                        Room: venues[0].Venue.Rooms[0]
                    }],
                    [{
                        End: new Date().getTime() + _.random(86401, 172800),
                        VenueId: venues[0].Id,
                        Room: venues[0].Venue.Rooms[0]
                    }],
                    [{
                        Start: new Date().getTime() + _.random(86401, 172800),
                        End: "string",
                        VenueId: venues[0].Id,
                        Room: venues[0].Venue.Rooms[0]
                    }],
                    [{
                        Start: new Date().getTime() + _.random(86401, 172800),
                        VenueId: venues[0].Id,
                        Room: venues[0].Venue.Rooms[0]
                    }],
                    [{
                        End: new Date().getTime() + _.random(10, 4000),
                        Start: new Date().getTime() + _.random(86401, 172800),
                        VenueId: 10,
                        Room: venues[0].Venue.Rooms[0]
                    }],
                    [{
                        End: new Date().getTime() + _.random(10, 4000),
                        Start: new Date().getTime() + _.random(86401, 172800),
                        VenueId: venues[0].Id
                    }],
                    [{
                        Start: new Date().getTime() + _.random(10, 4000),
                        End: new Date().getTime() + _.random(86401, 172800),
                        VenueId: 50,
                        Room: "notarealroom"
                    }],
                    [{
                        Start: new Date().getTime() + _.random(10, 4000),
                        End: new Date().getTime() + _.random(86401, 172800),
                        VenueId: {},
                        Room: "notarealroom"
                    }],
                    [{
                        Start: new Date().getTime() + _.random(10, 4000),
                        End: new Date().getTime() + _.random(86401, 172800),
                        VenueId: venues[0].Id,
                        Room: venues[0].Venue.Rooms[0]
                    }, {
                        Start: new Date().getTime() + _.random(10, 4000),
                        End: new Date().getTime() + _.random(86401, 172800),
                        VenueId: {},
                        Room: "notarealroom"
                    }],
                    [{
                        Start: new Date().getTime() + _.random(9999, 100000),
                        End: new Date().getTime() + _.random(1, 5),
                        VenueId: venues[0].Id,
                        Room: venues[0].Venue.Rooms[0]
                    }]
                ];
                var ev;

                for (var i = 0; i < badValues.length; i++) {
                    ev = JSON.parse(validEventJson);
                    ev.Occurrences = badValues[i];
                    invalidEvents.push(ev);
                }

                async.eachLimit(invalidEvents, 1, function(ev, cb) {
                    makeCreateEventRequest(ev, getToken(isAdmin))
                        .expect('Content-Type', jsonContentTypeRegex)
                        .expect(400)
                        .expect({
                            Error: "bad_occurrences"
                        }, cb);
                }, done);
            });
            it('should return 400 response "bad_venue" when invalid/non-existent venue is specified (' + role + ')');
            it('should return 400 response "bad_room" when invalid/non-existent room is specified (' + role + ')');
            if (role !== 'admin')
                it('should return 401 response "system_locked" when system is locked (' + role + ')');
        });
    });

    describe('/edit/[eventid]', function() {
        ['admin', 'contributor'].forEach(function(role) {
            it('should return 200 response for valid edit of existing event (' + role + ')');
            it('should return 400 response "wrong_content_type" when invalid content type header specified (' + role + ')');
            it('should return 400 response "invalid_json" when invalid JSON in request body (' + role + ')');
            it('should return 400 response "invalid_parameters" when extra parameters specified (' + role + ')');
            it('should return 400 response "invalid_parameters" when Occurrences is specified (' + role + ')');
            it('should return 400 response "bad_name" when an invalid Name is specified (' + role + ')');
            it('should return 400 response "bad_categories" when invalid or non-existent Categories are specified (' + role + ')');
            it('should return 400 response "bad_description" when invalid Description is specified (' + role + ')');
            it('should return 400 response "condition_violated" when an attempt is made to edit a non-existent event (' + role + ')');
            if (role !== 'admin') {
                it('should return 400 response "condition_violated" when an attempt is made to edit an event you do not own (' + role + ')');
                it('should return 401 response "system_locked" when system is locked (' + role + ')');
            }
        });
    });

    describe('/delete/[eventid]', function() {
        ['admin', 'contributor'].forEach(function(role) {
            it('should return 200 response for valid deletion of event (' + role + ')');
            it('should return 400 response "condition_violated" when an attempt is made to delete a non-existent event (' + role + ')');
            if (role !== 'admin') {
                it('should return 400 response "condition_violated" when an attempt is made to delete an event you do not own (' + role + ')');
                it('should return 401 response "system_locked" when system is locked (' + role + ')');
            }
        });
    });

    describe('/createoccurrence/[eventid]', function() {
        ['admin', 'contributor'].forEach(function(role) {
            it('should return 200 response and occurrence ID for creation of valid occurrence of existing event (' + role + ')');
            it('should return 400 response "wrong_content_type" when invalid content type header specified (' + role + ')');
            it('should return 400 response "invalid_json" when invalid JSON in request body (' + role + ')');
            it('should return 400 response "invalid_parameters" when extra parameters specified (' + role + ')');
            it('should return 400 response "invalid_parameters" when a parameter is missing (' + role + ')');
            it('should return 400 response "bad_start_end" when invalid start time is specified (' + role + ')');
            it('should return 400 response "bad_start_end" when invalid end time is specified (' + role + ')');
            it('should return 400 response "bad_start_end" when start time after end time is specified (' + role + ')');
            it('should return 400 response "bad_venue" when non-existent venue is specified (' + role + ')');
            it('should return 400 response "bad_room" when non-existent room is specified (' + role + ')');
            it('should return 400 response "condition_violated" when an attempt is made to add an occurrence to a non-existent event (' + role + ')');
            if (role !== 'admin') {
                it('should return 400 response "condition_violated" when an attempt is made to add an occurrence to an event you do not own (' + role + ')');
                it('should return 401 response "system_locked" when system is locked (' + role + ')');
            }
        });
    });

    describe('/editoccurrence/[occurrenceid]', function() {
        ['admin', 'contributor'].forEach(function(role) {
            it('should return 200 response for valid edit of existing event occurrence (' + role + ')');
            it('should return 400 response "wrong_content_type" when invalid content type header specified (' + role + ')');
            it('should return 400 response "invalid_json" when invalid JSON in request body (' + role + ')');
            it('should return 400 response "invalid_parameters" when extra parameters specified (' + role + ')');
            it('should return 400 response "bad_start_end" when invalid start time is specified (' + role + ')');
            it('should return 400 response "bad_start_end" when invalid end time is specified (' + role + ')');
            it('should return 400 response "bad_start_end" when start and end time specified, and start time is later than end time (' + role + ')');
            it('should return 400 response "condition_violated" when start time specified, end time isnt, and start time is later than existing end time (' + role + ')');
            it('should return 400 response "condition_violated" when end time specified, start time isnt, and end time is earlier than existing start time (' + role + ')');
            it('should return 400 response "cant_specify_venue_without_room" if a venue is specified but a room isnt');
            it('should return 400 response "bad_venue" when non-existent venue is specified (' + role + ')');
            it('should return 400 response "condition_violated" when non-existent room is specified (' + role + ')');
            it('should return 400 response "condition_violated" when an attempt is made to edit a non-existent occurrence (' + role + ')');
            if (role !== 'admin') {
                it('should return 400 response "condition_violated" when an attempt is made to edit an event occurrence you do not own (' + role + ')');
                it('should return 401 response "system_locked" when system is locked (' + role + ')');
            }
        });
    });

    describe('/deleteoccurrence/[occurrenceid]', function() {
        ['admin', 'contributor'].forEach(function(role) {
            it('should return 200 response for valid deletion of existing event occurrence (' + role + ')');
            it('should return 400 response "condition_violated" when an attempt is made to delete a non-existent occurrence (' + role + ')');
            if (role !== 'admin') {
                it('should return 400 response "condition_violated" when an attempt is made to delete an event occurrence you do not own (' + role + ')');
                it('should return 401 response "system_locked" when system is locked (' + role + ')');
            }
        });
    });

    describe('/details/[eventid]', function() {
        it('should return 200 response and event object for existing event');
        it('should return 404 response "event_not_found" for non-existent eventid');
    });

    describe('/all', function() {
        it('should return 200 response and empty list when no events in system');
        it('should return 200 response and list with one item when one event in system');
        it('should return 200 response and list with ten items sorted by start date/time when ten event occurrences in system');
        it('should return 200 response and NextToken parameter when 2,000 events in system, and get next page when next token URL parameter used in identical request');
        it('should return 400 response "bad_query" for invalid combinations in query string');
        describe("?sort=start", function() {
            it('should return 200 response and empty list when no events in system');
            it('should return 200 response and list with ten items sorted by start date/time when ten event occurrences in system');
        });
        describe("?sort=start&start=[start]", function() {
            it('should return 200 response and empty list when no events in system');
            it('should return 200 response and list without event occurrences that start before [start] when events both before and after [start] in system');
            it('should return 400 response "bad_query" when invalid [start] specified');
        });
        describe("?sort=start&start=[start]&end=[end]", function() {
            it('should return 200 response and empty list when no events in system');
            it('should return 200 response and list without event occurrences that start before [start] or finish after [end] when events starting both before and after [start] and ending before and after [end] exist in system');
            it('should return 400 response "bad_query" when invalid [start] and/or [end] specified');
        });
        describe("?sort=name", function() {
            it('should return 200 response and empty list when no events in system');
            it('should return 200 response and event occurrences sorted alphabetically by event name when events in system');
        });
    });

    describe('/search/[query]', function() {
        it('should return 200 response and empty list when no events in system');
        it('should return 200 response and event occurrences whose name has [query] as a substring sorted by start date/time');
        it('should return 400 response "bad_query" for invalid combinations in query string');
        describe("?sort=start", function() {
            it('should return 200 response and empty list when no events in system');
            it('should return 200 response and event occurrences whose name has [query] as a substring sorted by start date/time');
        });
        describe("?sort=start&start=[start]", function() {
            it('should return 200 response and empty list when no events in system');
            it('should return 200 response and event occurrences whose name has [query] as a substring sorted by start date/time (with occurrences starting before [start] omitted');
            it('should return 400 response "bad_query" when invalid [start] specified');
        });
        describe("?sort=start&start=[start]&end=[end]", function() {
            it('should return 200 response and empty list when no events in system');
            it('should return 200 response and event occurrences whose name has [query] as a substring sorted by start date/time (with occurrences starting before [start] and ending after [end] omitted');
            it('should return 400 response "bad_query" when invalid [start] and/or [end] specified');
        });
    });

    describe('/category/[catname]', function() {
        it('should return 200 response and empty list when no events in system');
        it('should return 200 response and event occurrences whose categories contain [catname] sorted by start date/time');
        it('should return 400 response "bad_query" for invalid combinations in query string');
        describe("?sort=start", function() {
            it('should return 200 response and empty list when no events in system');
            it('should return 200 response and event occurrences whose categories contain [catname] sorted by start date/time');
        });
        describe("?sort=start&start=[start]", function() {
            it('should return 200 response and empty list when no events in system');
            it('should return 200 response and event occurrences whose categories contain [catname] sorted by start date/time (with occurrences starting before [start] omitted');
            it('should return 400 response "bad_query" when invalid [start] specified');
        });
        describe("?sort=start&start=[start]&end=[end]", function() {
            it('should return 200 response and empty list when no events in system');
            it('should return 200 response and event occurrences whose categories contain [catname] sorted by start date/time (with occurrences starting before [start] and ending after [end] omitted');
            it('should return 400 response "bad_query" when invalid [start] and/or [end] specified');
        });
        describe("?sort=name", function() {
            it('should return 200 response and empty list when no events in system');
            it('should return 200 response and event occurrences whose categories contain [catname] sorted alphabetically by event name when events in system');
        });
    });

    describe('/ongoing/[time]', function() {
        it('should return 200 response and empty list when no events in system');
        it('should return 200 response and event occurrences that both start before [time] and finish after [time] sorted by start date/time');
        it('should return 400 response "bad_query" for invalid combinations in query string');
        it('should return 400 response "bad_query" for invalid [time] parameter');
        describe("?sort=start", function() {
            it('should return 200 response and empty list when no events in system');
            it('should return 200 response and event occurrences that both start before [time] and finish after [time] sorted by start date/time');
        });
        describe("?sort=name", function() {
            it('should return 200 response and empty list when no events in system');
            it('should return 200 response and event occurrences that both start before [time] and finish after [time] sorted alphabetically by event name when events in system');
        });
        describe("?sort=distance&lat=[latitude]&lon=[longitude]", function() {
            it('should return 200 response and empty list when no events in system');
            it('should return 200 response and event occurrences that both start before [time] and finish after [time] sorted by ascending geographic distance of their venue from (latitude,longitude)');
            it('should return 400 response "bad_query" when invalid [latitude] and/or [longitude] specified');
        });
    });

    function getToken(isAdmin) {
        return isAdmin ? main.adminToken : contributorToken;
    }

    /* returns eventId of the created event on success */
    function testValidCreateEvent(event, token, cb) {
        makeCreateEventRequest(event, token)
            .expect('Content-Type', jsonContentTypeRegex)
            .expect(function(res) {
                res.body.should.have.keys(['EventId']);
                res.body.EventId.should.be.a('string');
            }).expect(200, function(err, res) {
                if (err) return cb(err);
                var eventId = res.body.EventId;
                confirmEventExists(eventId, function(err) {
                    if (err) return cb(err);
                    cb(null, eventId);
                });
            });
    }

    function confirmEventExists(eventId, cb) {
        makeGetEventDetailsRequest(eventId)
            .expect(200, cb);
    }

    function makeGetEventDetailsRequest(eventId, token) {
        var route = '/api/events/details/' + eventId;
        if (token === undefined)
            return main.getWithSystemId(route, main.systemId);
        else
            return main.getWithToken(route, token);
    }

});

function makeCreateEventRequest(event, token) {
    return main.postWithToken('/api/events/create', token).send(event);
}

function createEvent(event, token, cb) {
    makeCreateEventRequest(event, token)
        .expect(200, function(err, res) {
            if (err) return cb(err);
            cb(null, res.body.EventId);
        });
}

function makeDeleteEventRequest(eventId, token) {
    return main.postWithToken('/api/events/delete/' + eventId, token);
}

exports.generateEvent = generateEvent;
exports.createEvent = createEvent;
exports.makeDeleteEventRequest = makeDeleteEventRequest;