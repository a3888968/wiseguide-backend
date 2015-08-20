'use strict';

var async = require('async'),
    dbUtil = require('../database/setupSchema'),
    systemId = 'TestSystemId_' + Date.now(),
    adminToken,
    jsonContentTypeRegex = /^application\/json/i; // case-insensitive, starts with application/json

before(function(done) { // root level hook, runs before all tests
    function checkReady(callback) {
        return callback(); // NOTE comment this if using supertest(app)
        /*if (app.get('trailAppReady')) callback();
		else setTimeout(function() {
			checkReady(callback);
		}, 200);*/
    }

    checkReady(function() {
        console.log('Creating System ID ' + "'" + systemId + "'...");
        createSystemId(systemId, function(err, token) {
            if (err) return done(err);
            exports.adminToken = adminToken = token;
            console.log("> Received admin token '" + adminToken + "'");
            done();
        });
    });
});

// after(function(done) { // root level hook, runs after all tests
// 	dbUtil.deleteSchema(done);
// });

describe('Authorization', function() {
    it("should return error 'bad_systemid' when an invalid system ID is supplied", function(done) {
        var invalidSystemIds = ['hahahahahahahahahahahahahahahhahaha', '---', '.', 0, 100];
        async.each(invalidSystemIds, function(systemId, callback) {
            postWithSystemId('/api/FAKE_ROUTE_TO_VERIFY_SYSTEMIDS', systemId)
                .expect('Content-Type', jsonContentTypeRegex)
                .expect(400)
                .expect({
                    Error: 'bad_systemid'
                }, callback);
        }, done);
    });
});

/*
 * This function creates a system ID and returns the corresponding admin token in cb
 */
function createSystemId(systemId, cb) {
    request.post('/admin/systems/create/' + systemId).send({
        Center: {
            Lat: 0,
            Lon: 0
        },
        AppendToLocationQuery: "Bristol",
        User: {
            Username: 'admin',
            Email: 'someadminemailaddress@notarealdomain.xyz',
            Password: 'l0ngP4ssw0rd',
            Name: 'The Administrator',
            Biography: 'Some biography',
            Summary: 'Some summary'
        }
    }).expect(200, function(err, res) {
        if (err) return cb(err);
        cb(null, res.body.Token);
    });
}

function verbWithSystemId(verb, route, systemId) { // helper function
    return request[verb](route).set('Authorization', 'SysId ' + systemId);
}

function verbWithToken(verb, route, token) {
    return request[verb](route).set('Authorization', 'JWT ' + token);
}

function getWithSystemId(route, systemId) {
    return verbWithSystemId('get', route, systemId);
}

function postWithSystemId(route, systemId) {
    return verbWithSystemId('post', route, systemId);
}

function getWithToken(route, token) {
    return verbWithToken('get', route, token);
}

function postWithToken(route, token) {
    return verbWithToken('post', route, token);
}

function testWrongContentType(route, invalidTypes, token, done) {
    // validType can be regex or exact string match
    var makeRequest;
    if (typeof token === 'function') {
        done = token;
        makeRequest = function() {
            return postWithSystemId(route, systemId);
        };
    } else
        makeRequest = function() {
            return postWithToken(route, token);
        };
    async.each(invalidTypes, function(type, callback) {
        makeRequest()
            .set('Content-Type', type)
            .expect('Content-Type', jsonContentTypeRegex)
            .expect(400)
            .expect({
                Error: 'wrong_content_type'
            }, callback);
    }, done);
}

function testInvalidJSON(route, invalidJSONString, token, done) {
    var req;
    if (typeof token === 'function') {
        done = token;
        req = postWithSystemId(route, systemId);
    } else
        req = postWithToken(route, token);
    req
        .set('Content-Type', 'application/json')
        .send(invalidJSONString)
        .expect('Content-Type', jsonContentTypeRegex)
        .expect(400)
        .expect({
            Error: 'invalid_json'
        }, done);
}

function PropVals(property, errorName, validValues, invalidValues) {
    this.property = property;
    this.errorName = errorName;
    this.values = {
        valid: validValues,
        invalid: invalidValues
    };
}

function testInvalidParameters(invalidObjects, makeRequest, cb) {
    async.each(invalidObjects, function(invalidObject, cb) {
        makeRequest(invalidObject)
            .expect('Content-Type', jsonContentTypeRegex)
            .expect(400)
            .expect({
                Error: 'invalid_parameters'
            }, cb);
    }, cb);
}

exports.createSystemId = createSystemId;
exports.systemId = systemId;
exports.getWithSystemId = getWithSystemId;
exports.postWithSystemId = postWithSystemId;
exports.getWithToken = getWithToken;
exports.postWithToken = postWithToken;
exports.jsonContentTypeRegex = jsonContentTypeRegex;
exports.testWrongContentType = testWrongContentType;
exports.testInvalidJSON = testInvalidJSON;
exports.PropVals = PropVals;
exports.testInvalidParameters = testInvalidParameters;