'use strict';

var async = require('async'),
    main = require('./main'),
    jsonContentTypeRegex = main.jsonContentTypeRegex,
    _ = require('lodash');

var generateUser = (function() {
    var count = 0;

    return function() {
        return {
            Username: 'fakeUser' + count,
            Email: 'someFakeEmail' + (count++) + '@gmail.com',
            Password: 'l0ngP4ssw0rd',
            Name: 'Some Name',
            Biography: 'Some biography',
            Summary: 'Some summary'
        };
    };
})();

describe('/api/users', function() {
    var propValsList = [
        new main.PropVals('Username', 'bad_username', ['123', 'abc', 'ab1', 'okayUsername', 'okayUsernam3', 'ooookayUsernam3', 'ooookayUsername'], ['11', 'LooooongUsernam3', 'LooooongUsername', 'LooooooooongUsername', 'space space', '', ' ', '   ', '1', 'a', 'a1', '1a']),
        new main.PropVals('Email', 'bad_email', ['validemail@gmail.com', 'validemail+alias@gmail.com', 'valid.email@gmail.com', 'valid_email@gmail.com', 'valid.email_123@gmail.com', 'haha@hotmail.co.uk', '434@mail.ru', '123@googlemail.com'], ['not a valid email@gmail.com', '', ' ', '@', '1@2', '1@3.4', '1@-3.co.uk', '1@.com', '***@***.com', '*@*.*', '@@@', '....', '_@_._']),
        new main.PropVals('Password', 'bad_password', ['sdfdsffds22ss', '!qwqwqw1!sddasdc', 'NJzX4rzh', 'B7aUc2mk', 'B2NqUmKg', 'hV7g3TWS', 'qQVqkMF4'], ['a', '123456789', 'abc123']), // short, no letters, letters and numbers but short
        new main.PropVals('Name', 'bad_name', ['Bob', 'Charlie', 'Adam Mooney', 'Ed', 'A', 'Reasonably Looooooooooong Name', '    Reasonably Looooooooooong Name     '], ['', ' ', '  ', 'A verrrrrrrrrrrryyyyy long name', 'A verrrrrrrrrrrryyyyyyyyyyyyyyy long nameeeeeeeeeeeeeeeeeeeee']),
        new main.PropVals('Biography', 'bad_biography', ['A', 'A', 'A ', ' A', 'Reasonable description!', 'Reasonable description!  ', '  Reasonable description!', 'Reasonable d3scription!'], ['', ' ', '  ']),
        new main.PropVals('Summary', 'bad_summary', ['A', 'A', 'A ', ' A', 'Reasonable summary!', 'Reasonable summary!  ', '  Reasonable summary!', 'Reasonable summary!'], ['', ' ', '  '])
    ];

    describe('/signup', function() {
        it('should return a valid response object when a valid request is posted', function(done) {
            this.timeout(90000); // this test can sometimes take a long time

            async.each(propValsList, function(propVals, callback) {
                async.each(propVals.values.valid, function(value, innerCallback) {
                    var user = generateUser();
                    user[propVals.property] = value; // re-assign a property

                    makeSignupUserRequest(user)
                        .expect('Content-Type', jsonContentTypeRegex)
                        .expect(200, function(err, res) {
                            if (err) return innerCallback(err);
                            res.body.should.not.have.property('Error');
                            var expectedUser = getExpectedUser(user, true);
                            checkLoginResponseIsValid(expectedUser, res.body, innerCallback);
                        });
                }, callback);
            }, done);
        });

        it("should return error 'wrong_content_type' when Content-Type is not 'application/json'", function(done) {
            main.testWrongContentType('/api/users/signup', ['image/jpeg', 'text/plain'], done);
        });

        it("should return error 'invalid_parameters' when an invalid or incomplete object is posted", function(done) {
            var invalidObjects = [{
                    rubbish: 2
                },
                _.omit(generateUser(), 'Username'),
                _.omit(generateUser(), 'Email'),
                _.omit(generateUser(), 'Password'),
                _.omit(generateUser(), 'Name'),
                _.omit(generateUser(), 'Biography'),
                _.omit(generateUser(), 'Summary'),
                _.omit(generateUser(), 'Username', 'Summary'),
                _.omit(generateUser(), 'Username', 'Biography'),
                _.assign(generateUser(), {
                    extra: 'note'
                })
            ];

            main.testInvalidParameters(invalidObjects, makeSignupUserRequest, done);
        });

        it("should return error 'invalid_json' when an invalid JSON is supplied", function(done) {
            main.testInvalidJSON('/api/users/signup', '{name: "Bob"}', done);
        });

        propValsList.forEach(function(propVals) {
            it("should return error '" + propVals.errorName + "' when an invalid " + propVals.property.toLowerCase() + " is supplied", function(done) {
                checkInvalidSignups(propVals.property, propVals.errorName, propVals.values.invalid, done);
            });
        });

        it("should return error 'username_exists' when the supplied username already exists", function(done) {
            testDuplicates('Username', 'username_exists', done);
        });

        it("should return error 'email_exists' when the supplied email already exists", function(done) {
            testDuplicates('Email', 'email_exists', done);
        });

        function testDuplicates(targetProperty, errorName, done) {
            var users = [generateUser(), generateUser()];
            users[1][targetProperty] = users[0][targetProperty];
            sendUser(users[0], false, function() {
                sendUser(users[1], true, done);
            });

            function sendUser(user, isDuplicate, callback) {
                makeSignupUserRequest(user)
                    .expect('Content-Type', jsonContentTypeRegex)
                    .expect(isDuplicate ? 400 : 200, function(err, res) {
                        if (err) return done(err);
                        if (isDuplicate)
                            res.body.should.have.property('Error', errorName);
                        else
                            res.body.should.not.have.property('Error');
                        callback();
                    });
            }
        }

        function checkInvalidSignups(targetProperty, errorName, invalidArray, done) {
            // errorName: target error name, e.g. 'bad_username'
            async.each(invalidArray, function(value, callback) {
                var user = generateUser();
                user[targetProperty] = value; // replace the targeted property with supplied value
                makeSignupUserRequest(user)
                    .expect('Content-Type', jsonContentTypeRegex)
                    .expect(400)
                    .expect({
                        Error: errorName
                    }, callback);
            }, done);
        }
    });

    describe('/login', function() {
        var user, expectedUser;

        before(function(done) {
            user = generateUser();
            user.getCredentials = function(usingEmail) {
                return {
                    Username: usingEmail ? this.Email : this.Username,
                    Password: this.Password
                };
            };
            expectedUser = getExpectedUser(user, true);
            makeSignupUserRequest(user)
                .end(done);
        });

        it('should allow a valid user to log in', function(done) {
            var creds_array = [user.getCredentials(), user.getCredentials(true)];
            async.each(creds_array, login, done);

            function login(creds, callback) {
                makeLoginRequest(creds)
                    .expect('Content-Type', jsonContentTypeRegex)
                    .expect(200, function(err, res) {
                        if (err) return callback(err);
                        res.body.should.not.have.property('Error');
                        checkLoginResponseIsValid(expectedUser, res.body, callback);
                    });
            }
        });

        it('should return 401 when an incorrect password is supplied', function(done) {
            var invalidPasswords = [' ', user.Password + user.Password,
                String.fromCharCode(user.Password.charCodeAt(0) + 1) + user.Password.substr(1), // change the first char by incrementing it
                user.Password.substr(1)
            ]; // missing first character
            if (user.Password.toUpperCase() !== user.Password) // if has lower case
                invalidPasswords.push(user.Password.toUpperCase());
            else
                invalidPasswords.push(user.Password.toLowerCase());
            async.each(invalidPasswords, login, done);

            function login(password, callback) {
                var creds = {
                    Username: user.Username,
                    Password: password
                };
                makeLoginRequest(creds)
                    .expect(401)
                    .expect({}, callback);
            }
        });

        it('should return 401 when an incorrect username is supplied', function(done) {
            var invalidUsernames = [' ', user.Username + user.Username,
                String.fromCharCode(user.Username.charCodeAt(0) + 1) + user.Username.substr(1),
                user.Username.substr(1)
            ];
            if (user.Username.toUpperCase() !== user.Username)
                invalidUsernames.push(user.Username.toUpperCase());
            else
                invalidUsernames.push(user.Username.toLowerCase());
            async.each(invalidUsernames, login, done);

            function login(username, callback) {
                var creds = {
                    Username: username,
                    Password: user.Password
                };
                makeLoginRequest(creds)
                    .expect(401)
                    .expect({}, callback);
            }
        });

        it("should return error 'invalid_parameters' when no password is supplied or it's invalid or empty", function(done) {
            var creds_array = [{
                Username: user.Username,
                Password: ''
            }, {
                Username: user.Username,
                Password: null
            }, {
                Username: user.Username,
                Password: undefined
            }, {
                Username: user.Username
            }, {
                Username: user.Username,
                Password: 0
            }, {
                Username: user.Username,
                Password: {}
            }, {
                Username: user.Username,
                Password: []
            }, {
                Username: user.Username,
                Password: {
                    Password: user.Password
                }
            }];

            async.each(creds_array, loginWithBadCreds('invalid_parameters'), done);
        });

        it("should return error 'invalid_parameters' when no username is supplied or it's invalid or empty", function(done) {
            var creds_array = [{
                Username: '',
                Password: user.Password
            }, {
                Username: null,
                Password: user.Password
            }, {
                Username: undefined,
                Password: user.Password
            }, {
                Password: user.Password
            }, {}, {
                Username: 0,
                Password: user.Password
            }, {
                Username: {},
                Password: user.Password
            }, {
                Username: [],
                Password: user.Password
            }, {
                Username: {
                    Username: user.Username
                },
                Password: user.Password
            }, ];

            async.each(creds_array, loginWithBadCreds('invalid_parameters'), done);
        });

        it("should return error 'wrong_content_type' when Content-Type is not 'application/json'", function(done) {
            main.testWrongContentType('/api/users/login', ['image/jpeg', 'text/plain'], done);
        });

        it("should return error 'invalid_json' when an invalid JSON is supplied", function(done) {
            main.testInvalidJSON('/api/users/login', '{Username: "Bob", "Password": "s3cret"}', done);
        });

        it("should return error 'invalid_parameters' when an invalid object is posted", function(done) {
            var invalidObjects = [{
                Username: 'U',
                Password: 'P',
                rubbish: 2
            }, {
                Username: 'U',
                Password: 'P',
                invalidObject: 'junk'
            }, ];

            main.testInvalidParameters(invalidObjects, makeLoginRequest, done);
        });

        function loginWithBadCreds(errorName) {
            return function(creds, callback) {
                makeLoginRequest(creds)
                    .expect('Content-Type', jsonContentTypeRegex)
                    .expect(400)
                    .expect({
                        Error: errorName
                    }, callback);
            };
        }
    });

    describe('/delete/<username>', function() {
        it('should delete a user if requested by an admin', function(done) {
            var user = generateUser(); // TODO perhaps also check an admin can delete another admin/themselves
            makeSignupUserRequest(user)
                .expect(200, function(err) {
                    if (err) return done(err);
                    makeDeleteRequest(user.Username, main.adminToken)
                        .expect(200)
                        .expect({}, confirmUserNotExists(user.Username, done));
                });
        });

        it('should delete a user if requested by the user themself', function(done) {
            var user = generateUser();
            makeSignupUserRequest(user)
                .expect(200, function(err, res) {
                    if (err) return done(err);
                    var userToken = res.body.Token;
                    makeDeleteRequest(user.Username, userToken)
                        .expect(200)
                        .expect({}, confirmUserNotExists(user.Username, done));
                });
        });

        it('should not delete a user if requested by a different contributor user', function(done) {
            var users = [generateUser(), generateUser()];
            async.map(users, signupUser, function(err, results) {
                if (err) return done(err);
                makeDeleteRequest(users[0].Username, results[1].Token)
                    .expect('Content-Type', jsonContentTypeRegex)
                    .expect(401)
                    .expect({
                        Error: 'not_permitted'
                    }, confirmUserExists(users[0].Username, done)); // check the user is still there
            });
        });

        it('should not delete an admin user if requested by a contributor user', function(done) {
            var user = generateUser();
            signupUser(user, function(err, result) {
                if (err) return done(err);
                makeDeleteRequest('admin', result.Token)
                    .expect('Content-Type', jsonContentTypeRegex)
                    .expect(401)
                    .expect({
                        Error: 'not_permitted'
                    }, confirmUserExists('admin', done));
            });
        });

        function makeDeleteRequest(username, token) {
            return main.postWithToken('/api/users/delete/' + username, token);
        }

        // the below two functions are to be passed as callbacks to supertest expect/end
        function confirmUserNotExists(username, callback) {
            return function(err) {
                if (err) return callback(err);
                makeGetUserDetailsRequest(username, main.adminToken)
                    .expect('Content-Type', jsonContentTypeRegex)
                    .expect(404)
                    .expect({
                        Error: 'user_not_found'
                    }, callback);
            };
        }

        function confirmUserExists(username, callback) {
            return function(err) {
                if (err) return callback(err);
                makeGetUserDetailsRequest(username, main.adminToken)
                    .expect('Content-Type', jsonContentTypeRegex)
                    .expect(200, callback);
            };
        }
    });

    describe('/edit', function() {
        it('should allow an authenticated user to modify their account details', function(done) {
            var listOfNewDetails = [{
                Name: 'James',
                Email: 'new_email@newdomain.co.uk'
            }, {
                Summary: 'New summary'
            }, {
                Biography: 'New Biography '
            }, {
                NewPassword: 'y0uc4ntgu3ssDisl0l',
                CurrentPassword: 'l0ngP4ssw0rd',
                Name: 'John'
            }];

            async.each(listOfNewDetails, function(newDetails, callback) {
                var user = generateUser();
                signupUser(user, function(err, result) {
                    if (err) return done(err);
                    var userToken = result.Token;
                    makeEditUserDetailsRequest(newDetails, userToken)
                        .expect(200)
                        .expect({}, function(err, res) {
                            if (err) return callback(err);
                            for (var prop in newDetails)
                                if (newDetails.hasOwnProperty(prop) && ['CurrentPassword', 'NewPassword'].indexOf(prop) === -1)
                                    user[prop] = newDetails[prop];
                            makeGetUserDetailsRequest(user.Username, userToken)
                                .expect(200)
                                .expect(getExpectedUser(user, true), !('CurrentPassword' in newDetails && 'NewPassword' in newDetails) ? callback : function(err, res) {
                                    if (err) return callback(err);
                                    makeLoginRequest({
                                        Username: user.Username,
                                        Password: newDetails.NewPassword
                                    })
                                        .expect(200, callback);
                                });
                        });
                });
            }, done);
        });

        it('should not allow a user to change their password without supplying their previous password', function(done) {
            var newDetailsList = [{
                NewPassword: 'n3wP4ssw0rd'
            }, {
                Password: 'n3wP4ssw0rd'
            }];
            async.each(newDetailsList, function(newDetails, callback) {
                var user = generateUser();
                signupUser(user, function(err, result) {
                    if (err) return callback(err);
                    var userToken = result.Token;
                    makeEditUserDetailsRequest(newDetails, userToken)
                        .expect('Content-Type', jsonContentTypeRegex)
                        .expect(400)
                        .expect({
                            Error: 'Password' in newDetails ? 'invalid_parameters' : 'wrong_password'
                        }, function(err, res) {
                            if (err) return callback(err);
                            makeLoginRequest({
                                Username: user.Username,
                                Password: 'Password' in newDetails ? newDetails.Password : newDetails.NewPassword
                            })
                                .expect(401, callback);
                            // TODO perhaps invalidate tokens when a password has been changed (not the one used to change the password though). More info here: http://stackoverflow.com/questions/21978658/invalidating-json-web-tokens
                        });
                });
            }, done);
        });

        it("should return error 'wrong_content_type' when Content-Type is not 'application/json'", function(done) {
            main.testWrongContentType('/api/users/edit', ['image/jpeg', 'text/plain'], main.adminToken, done);
        });

        it("should return error 'invalid_json' when an invalid JSON is supplied", function(done) {
            main.testInvalidJSON('/api/users/edit', '{NewPassword: "s3cret"}', main.adminToken, done);
        });

        it('should not allow a user to update their account details with invalid values', function(done) {
            var badValuesList = [
                new BadValues('invalid_parameters', [{
                    m: 0
                }, {
                    Username: 'hey',
                    junk: 2
                }, {
                    Password: '123321'
                }])
            ];

            propValsList.filter(function(propVals) {
                return ['bad_email', 'bad_password', 'bad_name', 'bad_biography', 'bad_summary'].indexOf(propVals.errorName) !== -1;
            }).forEach(function(propVals) {
                badValuesList.push(new BadValues(propVals.errorName,
                    propVals.values.invalid.map(function(value) {
                        var o = {};
                        if (propVals.property === 'Password') {
                            o.CurrentPassword = 'l0ngP4ssw0rd';
                            o.NewPassword = value;
                        } else
                            o[propVals.property] = value;
                        return o;
                    })));
            });

            async.eachSeries(badValuesList, function(badValues, callback) {
                var errorName = badValues.errorName;
                async.each(badValues.invalid, function(newDetails, callback2) {
                    var user = generateUser();
                    signupUser(user, function(err, result) {
                        if (err) return callback2(err);
                        var userToken = result.Token;
                        makeEditUserDetailsRequest(newDetails, userToken)
                            .expect('Content-Type', jsonContentTypeRegex)
                            .expect(400)
                            .expect({
                                Error: errorName
                            }, function(err, res) {
                                if (err) return callback2(err);
                                makeGetUserDetailsRequest(user.Username, userToken)
                                    .expect(200)
                                    .expect(getExpectedUser(user, true), !('CurrentPassword' in newDetails && 'NewPassword' in newDetails) ? callback2 : function(err, res) {
                                        if (err) return callback2(err);
                                        makeLoginRequest({
                                            Username: user.Username,
                                            Password: user.Password
                                        })
                                            .expect(200, callback2);
                                    });
                            });
                    });
                }, callback);
            }, done);

            function BadValues(errorName, invalid) {
                this.errorName = errorName;
                this.invalid = invalid;
            }
        });

        it("should return error 'email_exists' when the email is in use by another account", function(done) {
            var users = [generateUser(), generateUser()];
            async.map(users, signupUser, function(err, results) {
                if (err) return done(err);
                makeEditUserDetailsRequest({
                    Email: users[0].Email
                }, results[1].Token)
                    .expect('Content-Type', jsonContentTypeRegex)
                    .expect(400)
                    .expect({
                        Error: 'email_exists'
                    }, function(err, res) {
                        if (err) return done(err);
                        makeGetUserDetailsRequest(users[1].Username, results[1].Token)
                            .expect(200)
                            .expect(getExpectedUser(users[1], true), done);
                    });
            });
        });

        function makeEditUserDetailsRequest(newDetails, token) {
            return main.postWithToken('/api/users/edit', token).send(newDetails);
        }
    });

    describe('/details/<username>', function() {
        it('should get private user details for a requested user if requested by an admin', function(done) {
            var user = generateUser();
            signupUser(user, function(err) {
                if (err) return done(err);
                makeGetUserDetailsRequest(user.Username, main.adminToken)
                    .expect('Content-Type', jsonContentTypeRegex)
                    .expect(200)
                    .expect(getExpectedUser(user, true), done);
            });
        });

        it('should get private user details if requested by the user themself', function(done) {
            var user = generateUser();
            signupUser(user, function(err, result) {
                if (err) return done(err);
                makeGetUserDetailsRequest(user.Username, result.Token)
                    .expect('Content-Type', jsonContentTypeRegex)
                    .expect(200)
                    .expect(getExpectedUser(user, true), done);
            });
        });

        it('should get public user details for a requested user if requested by another contributor', function(done) {
            var users = [generateUser(), generateUser()];
            async.map(users, signupUser, function(err, results) {
                if (err) return done(err);
                makeGetUserDetailsRequest(users[0].Username, results[1].Token)
                    .expect('Content-Type', jsonContentTypeRegex)
                    .expect(200)
                    .expect(getExpectedUser(users[0]), done);
            });
        });

        it("should return error 'user_not_found' if there is no such user with the requested username", function(done) {
            makeGetUserDetailsRequest('iDoNotExist', main.adminToken)
                .expect('Content-Type', jsonContentTypeRegex)
                .expect(404)
                .expect({
                    Error: 'user_not_found'
                }, done);
        });
    });

    function getExpectedUser(signupUser, isPrivate) {
        // isPrivate is false by default
        var expectedUser = JSON.parse(JSON.stringify(signupUser));
        delete expectedUser.Password; // returned user should not have Password
        if (!isPrivate)
            delete expectedUser.Email;
        expectedUser.Role = ["contributor"]; // TODO allow other roles to be added
        trimProperties(expectedUser);
        return expectedUser;

        function trimProperties(user) {
            var noLeftTrimProps = ['Biography', 'Summary'];
            for (var prop in user) { // trim properties (except Password)
                if (typeof user[prop] === 'string' && prop !== 'Password')
                // if prop in this list, only trim right
                    user[prop] = noLeftTrimProps.indexOf(prop) !== -1 ? user[prop].trimRight() : user[prop].trim();
            }
        }
    }

    function checkLoginResponseIsValid(expectedUser, responseBody, callback) {
        responseBody.should.have.keys(['Token', 'Expires', 'User']);
        responseBody.Expires.should.be.above(Date.now());
        responseBody.User.should.deep.equal(expectedUser);

        main.postWithToken('/api/FAKE_ROUTE_TO_VERIFY_TOKENS', responseBody.Token) // verify token - if invalid, there will not be a 404 error
        .expect(404, function(err, res) {
            if (err) return callback(err);
            expect(res.body.Error).to.not.equal('invalid_or_expired_token');
            callback();
        });
    }
});

describe('Authorization', function() {
    it("should return error 'no_systemid_or_access_token' when no access token or system ID is supplied", function(done) {
        request.post('/api/FAKE_ROUTE_TO_VERIFY_TOKENS')
            .expect('Content-Type', jsonContentTypeRegex)
            .expect(400)
            .expect({
                Error: 'no_systemid_or_access_token'
            }, done);
    });

    it("should return error 'invalid_or_expired_token' when an invalid token is supplied", function(done) {
        var invalidTokens = ['hahahahahahahahahahahahahahahhahaha', '---', '.', 0, 100];
        async.each(invalidTokens, function(token, callback) {
            main.postWithToken('/api/FAKE_ROUTE_TO_VERIFY_TOKENS', token) // TODO actually target routes that expect this header
            .expect('Content-Type', jsonContentTypeRegex)
                .expect(401)
                .expect({
                    Error: 'invalid_or_expired_token'
                }, callback);
        }, done);
    });

    it("should return error 'require_access_token' when no access token is supplied to an endpoint requiring authentication", function(done) {
        var authRoutes = { // uncomment/add routes when they're complete
            post: [
                '/api/users/delete/someUsername',
                '/api/users/edit',
                '/api/categories/create',
                '/api/categories/delete/someCategory',
                '/api/categories/edit/someCategory',
                '/api/events/create',
                '/api/events/edit/someEvent',
                '/api/events/delete/someEvent',
                '/api/events/createoccurrence/someEvent',
                '/api/events/editoccurrence/someEvent',
                '/api/events/deleteoccurrence/someEvent',
                '/api/venues/create',
                '/api/venues/edit/someVenue',
                '/api/venues/delete/someVenue',
                '/api/venues/addroom/someVenue',
                '/api/venues/deleteroom/someVenue',
                '/api/system/lock',
                '/api/system/unlock'
            ],
            get: [
                '/api/users/details/someUsername',
            ]
        };

        var authRoutesFlattened = [];
        for (var verb in authRoutes) {
            if (authRoutes.hasOwnProperty(verb)) {
                for (var i = 0; i < authRoutes[verb].length; i++) {
                    authRoutesFlattened.push({
                        verb: verb,
                        route: authRoutes[verb][i]
                    });
                }
            }
        }

        async.each(authRoutesFlattened, function(entry, callback) {
            main[entry.verb + 'WithSystemId'](entry.route, main.systemId)
                .expect('Content-Type', jsonContentTypeRegex)
                .expect(401)
                .expect({
                    Error: 'require_access_token'
                }, callback);
        }, done);
    });
});

function makeSignupUserRequest(user, systemId) {
    return main.postWithSystemId('/api/users/signup', systemId === undefined ? main.systemId : systemId).send(user);
}

function makeLoginRequest(creds) {
    return main.postWithSystemId('/api/users/login', main.systemId).send(creds);
}

function makeGetUserDetailsRequest(username, token) {
    return main.getWithToken('/api/users/details/' + username, token);
}

function signupUser(user, systemId, callback) {
    if (typeof systemId === 'function') {
        callback = systemId;
        systemId = undefined;
    }
    makeSignupUserRequest(user, systemId)
        .expect(200, function(err, res) {
            if (err) return callback(err);
            callback(null, res.body);
        });
}

exports.generateUser = generateUser;
exports.signupUser = signupUser;