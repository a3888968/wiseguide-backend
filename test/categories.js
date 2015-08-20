'use strict';

var async = require('async'),
    main = require('./main'),
    jsonContentTypeRegex = main.jsonContentTypeRegex,
    users = require('./users');

describe('/api/categories', function() {
    var generateCategoryName = (function() {
        var count = 0;

        return function() {
            return 'Category' + (count++);
        };
    })();

    describe('/all', function() {
        var contributorToken;

        before(function(done) {
            users.signupUser(users.generateUser(), function(err, result) {
                if (err) return done(err);
                contributorToken = result.Token;
                done();
            });
        });

        it('should return a list of all categories created', function(done) {
            var categoryNames = [];
            checkAllCategories(function(err) {
                if (err) return done(err);
                async.timesSeries(5, function(i, cb) {
                    var name = generateCategoryName();
                    categoryNames.push(name.trim());
                    makeCreateCategoryRequest(name, main.adminToken)
                        .expect(200, cb);
                }, function(err) {
                    if (err) return done(err);
                    checkAllCategories(done);
                });
            });

            function checkAllCategories(cb) {
                async.each([undefined, main.adminToken, contributorToken], function(token, cb) {
                    makeGetAllCategoriesRequest(token)
                        .expect('Content-Type', jsonContentTypeRegex)
                        .expect(function(res) {
                            res.body.should.have.keys(['Categories']);
                            res.body.Categories.sort().should.deep.equal(categoryNames.sort());
                        }).expect(200, cb);
                }, cb);
            }
        });

        function makeGetAllCategoriesRequest(token) {
            var route = '/api/categories/all';
            if (token === undefined)
                return main.getWithSystemId(route, main.systemId);
            else
                return main.getWithToken(route, token);
        }
    });

    describe('/create', function() {
        var categoryNames = {
            valid: ['abc', 'catcatcatcatcat', 'c4t3g0ry', ' category       ', generateCategoryName()],
            invalid: ['', '  ', '   ', '    ', 'LongCategoryName', 'c$teg)ry', 'c asdsada']
        };

        it('should create a new event category when a valid name is supplied', function(done) {
            async.each(categoryNames.valid, function(name, cb) {
                makeCreateCategoryRequest(name, main.adminToken)
                    .expect(200)
                    .expect({}, cb);
            }, done);
        });

        it("should return error 'wrong_content_type' when Content-Type is not 'application/json'", function(done) {
            main.testWrongContentType('/api/categories/create', ['image/jpeg', 'text/plain'], main.adminToken, done);
        });

        it("should return error 'invalid_json' when an invalid JSON is supplied", function(done) {
            main.testInvalidJSON('/api/categories/create', '{Name: "Category"}', main.adminToken, done);
        });

        it("should return error 'bad_name' when an invalid name is supplied", function(done) {
            async.each(categoryNames.invalid, function(name, cb) {
                makeCreateCategoryRequest(name, main.adminToken)
                    .expect('Content-Type', jsonContentTypeRegex)
                    .expect(400)
                    .expect({
                        Error: 'bad_name'
                    }, cb);
            }, done);
        });

        it("should return error 'category_exists' when the supplied category already exists", function(done) {
            var categoryNames = [generateCategoryName(), generateCategoryName()];
            categoryNames[1] = categoryNames[0];
            makeCreateCategoryRequest(categoryNames[0], main.adminToken)
                .expect(200, function(err, res) {
                    if (err) return done(err);
                    makeCreateCategoryRequest(categoryNames[1], main.adminToken)
                        .expect('Content-Type', jsonContentTypeRegex)
                        .expect(400)
                        .expect({
                            Error: 'category_exists'
                        }, done);
                });
        });

        it("should return error 'not_permitted' if a contributor attempts to create a category", function(done) {
            users.signupUser(users.generateUser(), function(err, result) {
                if (err) return done(err);
                makeCreateCategoryRequest(generateCategoryName(), result.Token)
                    .expect('Content-Type', jsonContentTypeRegex)
                    .expect(401)
                    .expect({
                        Error: 'not_permitted'
                    }, done);
            });
        });
    });

});

function makeCreateCategoryRequest(categoryName, token) {
    return main.postWithToken('/api/categories/create', token).send({
        Name: categoryName
    });
}

exports.makeCreateCategoryRequest = makeCreateCategoryRequest;