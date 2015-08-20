'use strict';

var _ = require('lodash'),
    async = require('async'),
    main = require('./main'),
    jsonContentTypeRegex = main.jsonContentTypeRegex,
    users = require('./users'),
    events = require('./events'),
    system = require('./system');

function generateVenueRandomised() {
    return {
        Name: 'Some venue ' + _.random(1000000),
        Description: 'Venue description',
        Lat: _.random(-90.0, 90.0, true),
        Lon: _.random(-180.0, 180.0, true),
        Address: 'Bristol, UK',
        Rooms: ['Room' + _.random(1000000), 'Room' + _.random(1000000), 'Room' + _.random(1000000)]
    };
}

function generateVenue() {
    return {
        Name: 'Merchant Venturers Building',
        Description: 'Venue description',
        Lat: 10.5,
        Lon: 111.97,
        Address: 'Bristol, UK',
        Rooms: ['MVB 1.11A']
    };
}


var generateRoomName = (function() {
    var count = 0;

    return function() {
        return 'Room' + (count++);
    };
})();

describe('/api/venues', function() {
    var contributor = users.generateUser(),
        contributorToken;

    before(function(done) {
        users.signupUser(contributor, function(err, result) {
            if (err) return done(err);
            contributorToken = result.Token;
            done();
        });
    });

    describe('/all', function() {
        it('should return an empty list of venues at the beginning', function(done) {
            createNewSystemAndSignupContributor(function(err, params) {
                if (err) return done(err);
                checkAllVenues([], params, done);
            });
        });

        it('should reflect new/deleted rooms');
        it('should reflect changes made to venues');

        describe('when some venues have been created', function() {
            var venues = [],
                params;

            before(function(done) {
                createNewSystemAndSignupContributor(function(err, parameters) {
                    if (err) return done(err);
                    params = parameters;
                    async.timesSeries(5, function(i, cb) {
                        var venue = generateVenue();
                        createVenue(venue, params.adminToken, function(err, venueId) {
                            if (err) return cb(err);
                            venues.push(getExpectedVenue(venue, venueId));
                            cb();
                        });
                    }, done);
                });
            });

            it('should return a list of all venues created', function(done) {
                checkAllVenues(venues, params, done);
            });

            it('should return a list of all venues created when the system is locked', function(done) {
                system.lockSystem(true, params.adminToken, function(err) {
                    if (err) return done(err);
                    checkAllVenues(venues, params, function(err) {
                        if (err) return done(err);
                        system.lockSystem(false, params.adminToken, done);
                    });
                });
            });

            it('should return a list of all venues created once the system has been unlocked', function(done) {
                system.lockSystem(true, params.adminToken, function(err) {
                    if (err) return done(err);
                    system.lockSystem(false, params.adminToken, function(err) {
                        if (err) return done(err);
                        checkAllVenues(venues, params, done);
                    });
                });
            });
        });

        // returns systemId, adminToken and contributorToken in the callback
        function createNewSystemAndSignupContributor(cb) {
            var systemId = 'TestSystemId_' + Date.now();
            main.createSystemId(systemId, function(err, adminToken) {
                if (err) return cb(err);
                users.signupUser(users.generateUser(), systemId, function(err, result) {
                    if (err) return cb(err);
                    cb(null, {
                        systemId: systemId,
                        adminToken: adminToken,
                        contributorToken: result.Token
                    });
                });
            });
        }

        function checkAllVenues(venues, params, cb) {
            async.each([undefined, params.adminToken, params.contributorToken], function(token, cb) {
                makeGetAllVenuesRequest(token, params.systemId)
                    .expect('Content-Type', jsonContentTypeRegex)
                    .expect(function(res) {
                        res.body.should.have.keys(['Venues']);
                        res.body.Venues.forEach(function(ven) {
                            ven.Rooms = ven.Rooms.sort();
                        });
                        venues.forEach(function(ven) {
                            ven.Rooms = ven.Rooms.sort();
                        });
                        _.sortBy(res.body.Venues, 'VenueId').should.deep.equal(_.sortBy(venues, 'VenueId'));
                    }).expect(200, cb);
            }, cb);
        }
    });

    describe('/near', function() {
        describe('/<query>', function() {
            it('should return an empty list of venues at the beginning');
            it('should not crash if query is just whitespace');
            // try to crash it by giving bad queries
            // sort results by coordinates
            // postcode, museum in bristol, ambiguous, Sainsbury's (7 different places), something foreign, Russian address, German address, american postcode
        });
        describe('/<lat>/<lon>', function() {
            it('should return an empty list of venues at the beginning');
            // similar tests to above
        });
    });

    var propValsList = [
        new main.PropVals('Name', 'bad_name', ['Merchant Venturers Building', "  Queen's Building ", 'MVB', '    ' + _.trunc(_.repeat('MVB ', 8), {
            length: 30,
            omission: ''
        }) + '     ', 'G00gle HQ'], ['', '  ', '   ', '    ', 'a', 'ab', _.repeat('a', 31), 0, 10, {
                Name: 'MVB'
            }, {},
            [],
            [1],
            ['1'], null
        ]),
        new main.PropVals('Description', 'bad_description', ['Venue description', 'Old building', _.repeat('a', 3000)], ['', ' ', '  ', _.repeat('a', 3001), 0, 10, {
                Description: 'building'
            }, {},
            [],
            [1],
            ['1'], null
        ]),
        new main.PropVals('Lat', 'bad_lat', [0, 0.0, -90, -90.0, 90, 90.0, 45, 45.5, -45, -45.5], [-90.1, 90.1, '0', '91', {}, {
                Lat: 30
            },
            [],
            [1],
            ['1'], null
        ]), // MASSIVE TODO add numbers where strings are expected, etc
        new main.PropVals('Lon', 'bad_lon', [0, 0.0, -180, -180.0, 180, 180.0, 45, 45.5, -45, -45.5], [-180.1, 180.1, '0', '181', {}, {
                Lon: 30
            },
            [],
            [1],
            ['1'], null
        ]),
        new main.PropVals('Address', 'bad_address', ['London, UK', '1 Infinite Loop, Cupertino, CA 95014, United States', 'Google Mountain View\n1600 Amphitheatre\nParkway Mountain View, CA 94043'], ['', ' ', '  ', _.repeat('a', 101), 0, 10, {
                Address: 'London, UK'
            }, {},
            [],
            [1],
            ['1'], null
        ]),
        new main.PropVals('Rooms', 'bad_rooms', [
            ['a'],
            ['1'],
            ['a', 'b'],
            [_.repeat('a', 20)],
            ['a b c', 'MVB 1.15', 'QB 1.69']
        ], [
            [], {},
            0, ['2', '2'],
            [''],
            [' '],
            ['  '], 0, 10, {
                Rooms: ['a']
            }, {},
            [1], null
        ])
    ];

    describe('/create', function() {
        ['admin', 'contributor'].forEach(function(role) {
            var isAdmin = role === 'admin',
                roleWithArticle = (isAdmin ? 'an ' : 'a ') + role;

            it('should create a new venue when a valid request is posted by ' + roleWithArticle, function(done) {
                testValidCreateVenues(getToken(isAdmin), done);
            });

            it('should create a single venue for each request [' + role + ']', function(done) {
                getAllVenues(function(err, venuesBefore) {
                    if (err) return done(err);
                    var idsBefore = venuesBefore.map(function(venue) {
                        return venue.VenueId;
                    });

                    async.timesSeries(5, function(i, cb) {
                        testValidCreateVenue(generateVenue(), getToken(isAdmin), function(err, venueId) {
                            if (err) return cb(err);
                            getAllVenues(function(err, venuesNow) {
                                if (err) return cb(err);
                                var newVenues = venuesNow.filter(function(venue) {
                                    return idsBefore.indexOf(venue.VenueId) === -1;
                                });
                                newVenues.should.have.length(i + 1);
                                newVenues.some(function(venue) {
                                    return venue.VenueId === venueId;
                                }).should.equal(true);
                                cb();
                            });
                        });
                    }, done);
                });
            });

            it("should return error 'wrong_content_type' when Content-Type is not 'application/json' [" + role + "]", function(done) {
                confirmNoChangeInVenues(function(cb) {
                    main.testWrongContentType('/api/venues/create', ['image/jpeg', 'text/plain'], getToken(isAdmin), cb);
                }, done);
            });

            it("should return error 'invalid_json' when an invalid JSON is supplied by " + roleWithArticle, function(done) {
                confirmNoChangeInVenues(function(cb) {
                    main.testInvalidJSON('/api/venues/create', '{Name: "Merchant Venturers Building"}', getToken(isAdmin), cb);
                }, done);
            });

            it("should return error 'invalid_parameters' when an invalid or incomplete object is posted by " + roleWithArticle, function(done) {
                var invalidObjects = [{
                        rubbish: 2
                    },
                    _.omit(generateVenue(), 'Name'),
                    _.omit(generateVenue(), 'Description'),
                    _.omit(generateVenue(), 'Lat'),
                    _.omit(generateVenue(), 'Lon'),
                    _.omit(generateVenue(), 'Address'),
                    _.omit(generateVenue(), 'Rooms'),
                    _.omit(generateVenue(), 'Name', 'Rooms'),
                    _.omit(generateVenue(), 'Name', 'Lon'),
                    _.assign(generateVenue(), {
                        extra: 'note'
                    })
                ];

                confirmNoChangeInVenues(function(cb) {
                    main.testInvalidParameters(invalidObjects, function(obj) {
                        return makeCreateVenueRequest(obj, getToken(isAdmin));
                    }, cb);
                }, done);
            });

            it('should not allow ' + roleWithArticle + ' user to create a venue with invalid values', function(done) {
                testInvalidCreateVenues(getToken(isAdmin), done);
            });
        });

        it("should return error 'not_permitted' if the user does not have role 'contributor'", null && function(done) {
            var nonContributorToken; // todo register a non-contributor user, and potentially target all endpoints with this error
            confirmNoChangeInVenues(function(cb) {
                makeCreateVenueRequest(generateVenue(), nonContributorToken)
                    .expect('Content-Type', jsonContentTypeRegex)
                    .expect(401)
                    .expect({
                        Error: 'not_permitted'
                    }, cb);
            }, done);
        });

        describe('when the system is locked', function() {
            before(function(done) {
                system.lockSystem(true, done);
            });

            after(function(done) {
                system.lockSystem(false, done);
            });

            it("should return error 'system_locked' if a contributor tries to create a venue", function(done) {
                confirmNoChangeInVenues(function(cb) {
                    makeCreateVenueRequest(generateVenue(), contributorToken)
                        .expect('Content-Type', jsonContentTypeRegex)
                        .expect(401)
                        .expect({
                            Error: 'system_locked'
                        }, cb);
                }, done);
            });

            it('should create a venue if requested by an admin', function(done) {
                testValidCreateVenue(generateVenue(), main.adminToken, done);
            });
        });

        describe('once the system has been unlocked', function() {
            before(function(done) {
                system.lockSystem(true, function(err) {
                    if (err) return done(err);
                    system.lockSystem(false, done);
                });
            });

            ['an admin', 'a contributor'].forEach(function(role) {
                it('should allow ' + role + ' to create a venue', function(done) {
                    var token = getToken(role === 'an admin');
                    testValidCreateVenue(generateVenue(), token, done);
                });
            });
        });

        /* returns venueId of the created venue on success */
        function testValidCreateVenue(venue, token, cb) {
            makeCreateVenueRequest(venue, token)
                .expect('Content-Type', jsonContentTypeRegex)
                .expect(function(res) {
                    res.body.should.have.keys(['VenueId']);
                    res.body.VenueId.should.be.a('string');
                }).expect(200, function(err, res) {
                    if (err) return cb(err);
                    var venueId = res.body.VenueId;
                    confirmVenueExists(venueId, function(err) {
                        if (err) return cb(err);
                        cb(null, venueId);
                    });
                });
        }

        function testValidCreateVenues(token, cb) {
            async.eachSeries(propValsList, function(propVals, cb) {
                async.each(propVals.values.valid, function(value, cb) {
                    var venue = generateVenue();
                    venue[propVals.property] = value;

                    testValidCreateVenue(venue, token, cb);
                }, cb);
            }, cb);
        }

        function testInvalidCreateVenues(token, cb) {
            confirmNoChangeInVenues(function(cb) {
                async.eachSeries(propValsList, function(propVals, cb) {
                    async.each(propVals.values.invalid, function(value, cb) {
                        var venue = generateVenue();
                        venue[propVals.property] = value;

                        makeCreateVenueRequest(venue, token)
                            .expect('Content-Type', jsonContentTypeRegex)
                            .expect(400)
                            .expect({
                                Error: propVals.errorName
                            }, cb);
                    }, cb);
                }, cb);
            }, cb);
        }
    });

    describe('/edit', function() {
        ['admin', 'contributor'].forEach(function(role) {
            var isAdmin = role === 'admin',
                roleWithArticle = (isAdmin ? 'an ' : 'a ') + role;

            it('should edit an existing venue if a valid request is posted by the original creator [' + role + ']'); // Name, Description, Lat, Lon, Address
            it("should return error 'invalid_parameters' if Rooms are specified [" + role + "]");
            it("should return error 'wrong_content_type' when Content-Type is not 'application/json' [" + role + "]");
            it("should return error 'invalid_json' when an invalid JSON is supplied by " + roleWithArticle);
            it("should return error 'invalid_parameters' when an invalid or incomplete object is posted by " + roleWithArticle);
            it('should not allow ' + roleWithArticle + ' user to update a venue with invalid values'); // bad_name, bad_description, bad_lat, bad_lon, bad_address
            it("should return error 'condition_violated' if no venue has the requested ID [" + role + "]");
        });

        it('should allow an admin to edit an existing venue that belongs to a contributor');
        it("should return error 'condition_violated' and not edit an existing venue if requested by a contributor who did not create the venue");
        it("should return error 'not_permitted' if the user does not have role 'contributor'");

        describe('when the system is locked', function() {
            it("should return error 'system_locked' if a contributor tries to edit a venue");
            it('should allow an admin to edit a venue');
        });

        describe('once the system has been unlocked', function() {
            ['an admin', 'a contributor'].forEach(function(role) {
                it('should allow ' + role + ' to edit a venue they created');
            });
        });
    });

    describe('/delete/<ID>', function() {
        ['admin', 'contributor'].forEach(function(role) {
            var isAdmin = role === 'admin';

            it('should delete an existing venue if requested by the original creator [' + role + ']', function(done) {
                var venue = generateVenue(),
                    token = getToken(isAdmin);

                makeCreateVenueRequest(venue, token)
                    .expect(200, function(err, res) {
                        if (err) return done(err);
                        deleteVenueAndConfirm(res.body.VenueId, token, done);
                    });
            });

            it("should return error 'condition_violated' if no venue has the requested ID [" + role + "]", function(done) {
                var venueId = 'this is a very silly ID';
                confirmVenueNotExists(venueId, function(err, res) {
                    if (err) return done(err); // technically, should pick another ID and verify it doesn't exist, then proceed
                    confirmDeleteVenueError(400, 'condition_violated', venueId, getToken(isAdmin), done);
                });
            });

            it("should return error 'condition_violated' if events are hosted at this venue [" + role + "]");
        });

        it('should delete an existing venue that belongs to a contributor if requested by an admin', function(done) {
            makeCreateVenueRequest(generateVenue(), contributorToken)
                .expect(200, function(err, res) {
                    if (err) return done(err);
                    deleteVenueAndConfirm(res.body.VenueId, main.adminToken, done);
                });
        });

        it("should return error 'condition_violated' and not delete an existing venue if requested by a contributor who did not create the venue", function(done) {
            users.signupUser(users.generateUser(), function(err, result) {
                if (err) return done(err);
                var newContributorToken = result.Token;
                // create venues by admin and contributor, then try to delete using newContributorToken
                async.map([main.adminToken, contributorToken], function(token, cb) {
                    makeCreateVenueRequest(generateVenue(), token)
                        .expect(200, function(err, res) {
                            if (err) return cb(err);
                            cb(null, res.body.VenueId);
                        });
                }, function(err, venueIds) {
                    if (err) return done(err);
                    async.each(venueIds, function(venueId, cb) {
                        confirmDeleteVenueError(400, 'condition_violated', venueId, newContributorToken, cb);
                    }, done);
                });
            });
        });

        describe('when the system is locked', function() {
            var venueId;

            beforeEach(function(done) {
                makeCreateVenueRequest(generateVenue(), contributorToken)
                    .expect(200, function(err, res) {
                        if (err) return done(err);
                        venueId = res.body.VenueId;
                        system.lockSystem(true, done);
                    });
            });

            afterEach(function(done) {
                system.lockSystem(false, done);
            });

            it("should return error 'system_locked' if a contributor tries to delete a venue", function(done) {
                confirmDeleteVenueError(401, 'system_locked', venueId, contributorToken, done);
            });

            it('should delete an existing venue if requested by an admin', function(done) {
                deleteVenueAndConfirm(venueId, main.adminToken, done);
            });
        });

        describe('once the system has been unlocked', function() {
            before(function(done) {
                system.lockSystem(true, function(err) {
                    if (err) return done(err);
                    system.lockSystem(false, done);
                });
            });

            ['an admin', 'a contributor'].forEach(function(role) {
                it('should allow ' + role + ' to delete a venue they created', function(done) {
                    var token = getToken(role === 'an admin');
                    createVenue(generateVenue(), token, function(err, venueId) {
                        if (err) return done(err);
                        deleteVenueAndConfirm(venueId, token, done);
                    });
                });
            });
        });

        function confirmDeleteVenueError(code, error, venueId, token, cb) {
            confirmNoChangeInVenues(function(cb) {
                makeDeleteVenueRequest(venueId, token)
                    .expect('Content-Type', jsonContentTypeRegex)
                    .expect(code)
                    .expect({
                        Error: error
                    }, cb);
            }, cb);
        }

        function deleteVenueAndConfirm(venueId, token, cb) {
            makeDeleteVenueRequest(venueId, token)
                .expect(200)
                .expect({}, function(err, res) {
                    if (err) return cb(err);
                    confirmVenueNotExists(venueId, cb);
                });
        }
    });

    describe('/details/<ID>', function() {
        it('should get the details of a requested venue', function(done) {
            var venue = generateVenue();
            venue.Rooms = ["Room"];
            makeCreateVenueRequest(venue, contributorToken)
                .expect(200, function(err, res) {
                    if (err) return done(err);
                    // todo occurrence_in_venue objects and new/deleted rooms
                    var venueId = res.body.VenueId;
                    async.each([undefined, main.adminToken, contributorToken], function(token, cb) {
                        makeGetVenueDetailsRequest(venueId, token)
                            .expect('Content-Type', jsonContentTypeRegex)
                            .expect(200)
                            .expect(getExpectedVenue(venue, venueId, []), cb);
                    }, done);
                });
        });

        it("should return error 'venue_not_found' if no venue has the requested ID", function(done) {
            var venueId = 'this is a very silly ID';
            async.each([undefined, main.adminToken, contributorToken], function(token, cb) {
                makeGetVenueDetailsRequest(venueId, token)
                    .expect('Content-Type', jsonContentTypeRegex)
                    .expect(404)
                    .expect({
                        Error: 'venue_not_found'
                    }, cb);
            }, done);
        });
    });

    var invalidRooms = [{
        rubbish: 2
    }, {
        Naame: 'Room'
    }, {
        Name: generateRoomName(),
        extra: 'note'
    }];

    var roomNames = {
        valid: ['a', 'upstairs', 'downstairs', 'ro0m', '1.11A', "R'n'R room", 'R & B room', _.repeat('!', 40), _.repeat(' ', 40) + ' room' + _.repeat(' ', 40), generateRoomName()],
        invalid: ['', '  ', '   ', '    ', _.repeat('a', 41)]
    };

    describe('/addroom/<ID>', function() {
        ['admin', 'contributor'].forEach(function(role) {
            var isAdmin = role === 'admin',
                roleWithArticle = (isAdmin ? 'an ' : 'a ') + role;

            it('should add a new room to a venue if requested by the original creator [' + role + ']', function(done) {
                testValidAddRooms(getToken(isAdmin), done);
            });
            it("should return error 'wrong_content_type' when Content-Type is not 'application/json' [" + role + "]", function(done) {
                confirmNoChangeInVenues(function(cb) {
                    main.testWrongContentType('/api/venues/addroom/fakeVenueId', ['image/jpeg', 'text/plain'], getToken(isAdmin), cb);
                }, done);
            });
            it("should return error 'invalid_json' when an invalid JSON is supplied by " + roleWithArticle, function(done) {
                confirmNoChangeInVenues(function(cb) {
                    main.testInvalidJSON('/api/venues/addroom/fakeVenueId', '{Name: "MVB 1.11A"}', getToken(isAdmin), cb);
                }, done);
            });
            it("should return error 'invalid_parameters' when the posted object does not have the 'Name' parameter only [" + role + "]", function(done) {
                createVenue(generateVenue(), getToken(isAdmin), function(err, venueId) {
                    if (err) return done(err);
                    confirmNoChangeInVenues(function(cb) {
                        main.testInvalidParameters(invalidRooms, function(obj) {
                            return makeAddRoomRequest(obj, venueId, getToken(isAdmin));
                        }, cb);
                    }, done);
                });
            });
            it('should not allow ' + roleWithArticle + ' user to add a room with an invalid name', function(done) {
                testInvalidAddRooms(getToken(isAdmin), done);
            });
            it("should return error 'condition_violated' if no venue has the requested ID [" + role + "]", function(done) {
                var venueId = 'this is a very silly ID';
                confirmVenueNotExists(venueId, function(err, res) {
                    if (err) return done(err);
                    confirmAddRoomError(400, 'condition_violated', generateRoomName(), venueId, getToken(isAdmin), done);
                });
            });
        });

        it('should add a new room to a venue belonging to a contributor if requested by an admin', function(done) {
            createVenue(generateVenue(), contributorToken, function(err, venueId) {
                if (err) return done(err);
                testValidAddRoom(generateRoomName(), venueId, main.adminToken, true, done);
            });
        });
        it("should return error 'condition_violated' if requested by a contributor who did not create the venue", function(done) {
            users.signupUser(users.generateUser(), function(err, result) {
                if (err) return done(err);
                var newContributorToken = result.Token;
                async.map([main.adminToken, contributorToken], function(token, cb) {
                    createVenue(generateVenue(), token, cb);
                }, function(err, venueIds) {
                    if (err) return done(err);
                    async.each(venueIds, function(venueId, cb) {
                        confirmAddRoomError(400, 'condition_violated', generateRoomName(), venueId, newContributorToken, cb);
                    }, done);
                });
            });
        });
        it("should return error 'not_permitted' if the user does not have role 'contributor'");

        describe('when the system is locked', function() {
            var venueId;

            beforeEach(function(done) {
                createVenue(generateVenue(), contributorToken, function(err, venId) {
                    if (err) return done(err);
                    venueId = venId;
                    system.lockSystem(true, done);
                });
            });

            afterEach(function(done) {
                system.lockSystem(false, done);
            });

            it("should return error 'system_locked' if a contributor tries to add a room", function(done) {
                confirmAddRoomError(401, 'system_locked', generateRoomName(), venueId, contributorToken, done);
            });

            it('should add a room if requested by an admin', function(done) {
                testValidAddRoom(generateRoomName(), venueId, main.adminToken, true, done);
            });
        });

        describe('once the system has been unlocked', function() {
            before(function(done) {
                system.lockSystem(true, function(err) {
                    if (err) return done(err);
                    system.lockSystem(false, done);
                });
            });

            ['an admin', 'a contributor'].forEach(function(role) {
                it('should allow ' + role + ' to add a room to a venue they created', function(done) {
                    var token = getToken(role === 'an admin');
                    createVenue(generateVenue(), token, function(err, venueId) {
                        if (err) return done(err);
                        testValidAddRoom(generateRoomName(), venueId, token, true, done);
                    });
                });
            });
        });

        function testValidAddRoom(name, venueId, token, shouldConfirmRoomExists, cb) {
            makeAddRoomRequest(name, venueId, token)
                .expect(200)
                .expect({}, function(err, res) {
                    if (err) return cb(err);
                    if (shouldConfirmRoomExists)
                        confirmRoomExists(name.trim(), venueId, cb);
                    else cb();
                });
        }

        function testValidAddRooms(token, cb) {
            var venue = generateVenue();
            createVenue(venue, token, function(err, venueId) {
                if (err) return cb(err);
                async.eachLimit(roomNames.valid, 2, function(name, cb) {
                    testValidAddRoom(name, venueId, token, false, cb);
                }, function(err) {
                    if (err) return cb(err);
                    makeGetVenueDetailsRequest(venueId)
                        .expect(function(res) {
                            var trimmedNames = venue.Rooms.concat(roomNames.valid).map(function(name) {
                                return name.trim();
                            });
                            res.body.Rooms.sort().should.deep.equal(trimmedNames.sort());
                        }).expect(200, cb);
                });
            });
        }

        function testInvalidAddRooms(token, cb) {
            createVenue(generateVenue(), token, function(err, venueId) {
                if (err) return cb(err);
                confirmNoChangeInVenues(function(cb) {
                    async.each(roomNames.invalid, function(name, cb) {
                        makeAddRoomRequest(name, venueId, token)
                            .expect('Content-Type', jsonContentTypeRegex)
                            .expect(400)
                            .expect({
                                Error: 'bad_name'
                            }, cb);
                    }, cb);
                }, cb);
            });
        }

        function confirmAddRoomError(code, error, name, venueId, token, cb) {
            confirmNoChangeInVenues(function(cb) {
                makeAddRoomRequest(name, venueId, token)
                    .expect('Content-Type', jsonContentTypeRegex)
                    .expect(code)
                    .expect({
                        Error: error
                    }, cb);
            }, cb);
        }
    });

    describe('/deleteroom/<ID>', function() {
        var twoRoomVenue = _.assign(generateVenue(), {
            Rooms: [generateRoomName(), generateRoomName()]
        });
        ['admin', 'contributor'].forEach(function(role) {
            var isAdmin = role === 'admin',
                roleWithArticle = (isAdmin ? 'an ' : 'a ') + role;

            it('should remove a room from a venue if requested by the original creator [' + role + ']', function(done) {
                var room = twoRoomVenue.Rooms[0];
                testValidDeleteOwnRoom(room, twoRoomVenue, getToken(isAdmin), done);
            });
            it('should remove a room from a venue if requested by the original creator despite leading and trailing whitespace in the input[' + role + ']', function(done) {
                var room = '  ' + twoRoomVenue.Rooms[0] + '  ';
                testValidDeleteOwnRoom(room, twoRoomVenue, getToken(isAdmin), done);
            });
            it('should return 200 if the room does not exist in the venue if requested by the original creator [' + role + ']', function(done) {
                testValidDeleteOwnRoom('silly room name', twoRoomVenue, getToken(isAdmin), done);
            });
            it("should return error 'wrong_content_type' when Content-Type is not 'application/json' [" + role + "]", function(done) {
                confirmNoChangeInVenues(function(cb) {
                    main.testWrongContentType('/api/venues/deleteroom/fakeVenueId', ['image/jpeg', 'text/plain'], getToken(isAdmin), cb);
                }, done);
            });
            it("should return error 'invalid_json' when an invalid JSON is supplied by " + roleWithArticle, function(done) {
                confirmNoChangeInVenues(function(cb) {
                    main.testInvalidJSON('/api/venues/deleteroom/fakeVenueId', '{Name: "MVB 1.11A"}', getToken(isAdmin), cb);
                }, done);
            });
            it("should return error 'invalid_parameters' when the posted object does not have the 'Name' parameter only [" + role + "]", function(done) {
                createVenue(twoRoomVenue, getToken(isAdmin), function(err, venueId) {
                    if (err) return done(err);
                    confirmNoChangeInVenues(function(cb) {
                        main.testInvalidParameters(invalidRooms, function(obj) {
                            return makeDeleteRoomRequest(obj, venueId, getToken(isAdmin));
                        }, cb);
                    }, done);
                });
            });
            it('should not allow ' + roleWithArticle + ' user to remove a room with an invalid name', function(done) {
                var token = getToken(isAdmin);
                createVenue(twoRoomVenue, token, function(err, venueId) {
                    if (err) return done(err);
                    confirmNoChangeInVenues(function(cb) {
                        async.each(roomNames.invalid, function(name, cb) {
                            testDeleteRoomError(400, 'bad_name', name, venueId, token, cb);
                        }, cb);
                    }, done);
                });
            });
            it("should return error 'room_has_events' if the room has events assigned to it, and succeed once the events are removed [" + role + "]", function(done) {
                var token = getToken(isAdmin);
                var room = twoRoomVenue.Rooms[0];
                createVenue(twoRoomVenue, token, function(err, venueId) {
                    if (err) return done(err);
                    var ev = events.generateEvent([], [{
                        VenueId: venueId,
                        Room: room
                    }]);
                    events.createEvent(ev, token, function(err, eventId) {
                        if (err) return done(err);
                        confirmDeleteRoomError(400, 'room_has_events', room, venueId, token, function(err) {
                            if (err) return done(err);
                            events.makeDeleteEventRequest(eventId, token)
                                .expect(200, function(err, res) {
                                    if (err) return done(err);
                                    testValidDeleteRoom(room, venueId, token, done);
                                });
                        });
                    });
                });
            });
            it("should return error 'condition_violated' if the requested room is the only room in the venue [" + role + "]", function(done) {
                var token = getToken(isAdmin),
                    venue = _.assign(generateVenue(), {
                        Rooms: [generateRoomName()]
                    });
                createVenue(venue, token, function(err, venueId) {
                    if (err) return done(err);
                    confirmDeleteRoomError(400, 'condition_violated', venue.Rooms[0], venueId, token, done);
                });
            });
            it("should return error 'condition_violated' if no venue has the requested ID [" + role + "]", function(done) {
                var venueId = 'this is a very silly ID';
                confirmVenueNotExists(venueId, function(err, res) {
                    if (err) return done(err);
                    confirmDeleteRoomError(400, 'condition_violated', generateRoomName(), venueId, getToken(isAdmin), done);
                });
            });
        });
        it('should remove a room from a venue belonging to a contributor if requested by an admin', function(done) {
            createVenue(twoRoomVenue, contributorToken, function(err, venueId) {
                if (err) return done(err);
                testValidDeleteRoom(twoRoomVenue.Rooms[1], venueId, main.adminToken, done);
            });
        });
        it("should return error 'condition_violated' if requested by a contributor who did not create the venue", function(done) {
            users.signupUser(users.generateUser(), function(err, result) {
                if (err) return done(err);
                var newContributorToken = result.Token;
                async.map([main.adminToken, contributorToken], function(token, cb) {
                    createVenue(twoRoomVenue, token, cb);
                }, function(err, venueIds) {
                    if (err) return done(err);
                    async.each(venueIds, function(venueId, cb) {
                        confirmDeleteRoomError(400, 'condition_violated', twoRoomVenue.Rooms[0], venueId, newContributorToken, cb);
                    }, done);
                });
            });
        });
        it("should return error 'not_permitted' if the user does not have role 'contributor'");
        describe('when the system is locked', function() {
            var venueId,
                room = twoRoomVenue.Rooms[0];

            beforeEach(function(done) {
                createVenue(twoRoomVenue, contributorToken, function(err, venId) {
                    if (err) return done(err);
                    venueId = venId;
                    system.lockSystem(true, done);
                });
            });

            afterEach(function(done) {
                system.lockSystem(false, done);
            });

            it("should return error 'system_locked' if a contributor tries to remove a room", function(done) {
                confirmDeleteRoomError(401, 'system_locked', room, venueId, contributorToken, done);
            });
            it('should remove a room if requested by an admin', function(done) {
                testValidDeleteRoom(room, venueId, main.adminToken, done);
            });
        });
        describe('once the system has been unlocked', function() {
            before(function(done) {
                system.lockSystem(true, function(err) {
                    if (err) return done(err);
                    system.lockSystem(false, done);
                });
            });

            ['an admin', 'a contributor'].forEach(function(role) {
                it('should allow ' + role + ' to remove a room from a venue they created', function(done) {
                    var token = getToken(role === 'an admin');
                    testValidDeleteOwnRoom(twoRoomVenue.Rooms[0], twoRoomVenue, token, done);
                });
            });
        });

        function testValidDeleteRoom(name, venueId, token, cb) {
            makeDeleteRoomRequest(name, venueId, token)
                .expect(200)
                .expect({}, function(err, res) {
                    if (err) return cb(err);
                    confirmRoomNotExists(name.trim(), venueId, cb);
                });
        }

        function testValidDeleteOwnRoom(name, venue, token, cb) {
            createVenue(venue, token, function(err, venueId) {
                if (err) return cb(err);
                testValidDeleteRoom(name, venueId, token, cb);
            });
        }

        function testDeleteRoomError(code, error, name, venueId, token, cb) {
            makeDeleteRoomRequest(name, venueId, token)
                .expect('Content-Type', jsonContentTypeRegex)
                .expect(code)
                .expect({
                    Error: error
                }, cb);
        }

        function confirmDeleteRoomError(code, error, name, venueId, token, cb) {
            confirmNoChangeInVenues(function(cb) {
                testDeleteRoomError(code, error, name, venueId, token, cb);
            }, cb);
        }
    });

    function makeDeleteVenueRequest(venueId, token) {
        return main.postWithToken('/api/venues/delete/' + venueId, token);
    }

    function makeGetAllVenuesRequest(token, systemId) {
        var route = '/api/venues/all';
        if (token === undefined)
            return main.getWithSystemId(route, systemId === undefined ? main.systemId : systemId);
        else
            return main.getWithToken(route, token);
    }

    function getAllVenues(cb) {
        makeGetAllVenuesRequest()
            .expect(200, function(err, res) {
                if (err) return cb(err);
                cb(null, res.body.Venues);
            });
    }

    function makeGetVenueDetailsRequest(venueId, token) {
        var route = '/api/venues/details/' + venueId;
        if (token === undefined)
            return main.getWithSystemId(route, main.systemId);
        else
            return main.getWithToken(route, token);
    }

    function makeAddOrDeleteRoomRequest(action, room, venueId, token) {
        return main.postWithToken('/api/venues/' + action + 'room/' + venueId, token).send(typeof room === 'string' ? {
            Name: room
        } : room);
    }

    function makeAddRoomRequest(room, venueId, token) {
        return makeAddOrDeleteRoomRequest('add', room, venueId, token);
    }

    function makeDeleteRoomRequest(room, venueId, token) {
        return makeAddOrDeleteRoomRequest('delete', room, venueId, token);
    }

    function getToken(isAdmin) {
        return isAdmin ? main.adminToken : contributorToken;
    }

    /* Takes in a function fn, whose only parameter is a callback (err, res), and a final callback cb.
     * It first gets all venues, invokes fn, then gets venues again and verifies they haven't changed.
     */
    function confirmNoChangeInVenues(fn, cb) {
        getAllVenues(function(err, venuesBefore) {
            if (err) return cb(err);
            fn(function(err, res) { // fn is called with one param - callback that has err, res
                if (err) return cb(err);
                getAllVenues(function(err, venuesAfter) {
                    if (err) return cb(err);
                    venuesAfter.should.deep.equal(venuesBefore);
                    cb();
                });
            });
        });
    }

    function confirmVenueExists(venueId, cb) {
        makeGetVenueDetailsRequest(venueId)
            .expect(200, cb);
    }

    function confirmVenueNotExists(venueId, cb) {
        makeGetVenueDetailsRequest(venueId)
            .expect(404)
            .expect({
                Error: 'venue_not_found'
            }, cb);
    }

    function getExpectedVenue(venue, venueId, eventOccurrences) {
        var expectedVenue = JSON.parse(JSON.stringify(venue));
        expectedVenue.VenueId = venueId;
        _.forOwn(expectedVenue, function(value, key, obj) {
            if (typeof value === 'string')
                obj[key] = value.trim();
        }); // todo perhaps change other functions to use lodash because it does hasOwnProperty

        if (eventOccurrences !== undefined)
            expectedVenue.EventOccurrences = eventOccurrences;

        return expectedVenue;
    }

    function confirmRoomExists(name, venueId, cb) {
        makeGetVenueDetailsRequest(venueId)
            .expect(function(res) {
                res.body.Rooms.should.include(name);
            }).expect(200, cb);
    }

    function confirmRoomNotExists(name, venueId, cb) {
        makeGetVenueDetailsRequest(venueId)
            .expect(function(res) {
                res.body.Rooms.should.not.include(name);
            }).expect(200, cb);
    }
});

function makeCreateVenueRequest(venue, token) {
    return main.postWithToken('/api/venues/create', token).send(venue);
}

function createVenue(venue, token, cb) {
    makeCreateVenueRequest(venue, token)
        .expect(200, function(err, res) {
            if (err) return cb(err);
            cb(null, res.body.VenueId);
        });
}

exports.generateVenueRandomised = generateVenueRandomised;
exports.generateVenue = generateVenue;
exports.createVenue = createVenue;