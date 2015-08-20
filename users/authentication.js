"use strict";

/*
This module handles authentication of users.
*/

var dbUsers = require('../database/users');
var dbSystems = require('../database/systems');
var hash = require('./hash');
var validator = require('validator');
var jwt = require('jwt-simple');
var moment = require('moment');

var secret = "O.,|5Mc/Qp(:-+Ky1bl}<cEfSv?qTfT6UHsewegIMyI:+%4#^~@L+r4JX0Tz[Esn^~l0aAW}UrgO6e+2REH|+}@E~*?R<!Wxfr3M;)]lE?XfR2uOEF?'6J9l2IO^L=Og/rGA)Gy/kR;5qWlNA{Atxu[8(s@,l^ri@&R@uRzaSWM*j8r&fKKly{~0Rn.-l8F)o%Ho]!8:?!;;^e_U=wJ34PYk?2o-Y71}VEwz&h:W#HQ&,ibr:j0gj5&hYbKZ*%ae";

/* 
Call this with a user object retrieved from the database and a password supplied
by the user in order to retrieve a token. 
Arguments:
- userObj = object : the user object for the user being authenticated (from database)
- givenPassword = string : the plaintext password supplied by the user
- callback = function(token, expires) : token is the JWT and expires is the expiry date
               of the token. If either is unset, authentication failed (likely due to
               the user supplying the wrong password)
*/
function authenticateUser(userObj, givenPassword, callback) {
    if (!userObj)
        return callback(null, null);
    if (!givenPassword)
        return callback(null, null);
    if (!hash.checkPassword(givenPassword, userObj.Password))
        return callback(null, null);

    // User has authenticated OK
    var expires = moment().add(7, 'days').valueOf();
    var token = jwt.encode({
        iss: userObj.SystemId,
        sub: userObj.Username,
        exp: expires
    }, secret, 'HS512');

    return callback(token, expires);
}

/* 
Call this after parsing the Authentication header of the request to generate
a fresh token for a logged in user. Only works if already authenticated.
Arguments:
- req = Express HTTP Request object
- callback = function(token, expires) : token is the JWT and expires is the expiry date
               of the token. If either is unset, the request was not originally authenticated
               correctly and so the new token request is denied)
*/
function renewLogin(req, callback) {
    if (req.user) {
        // User has authenticated OK
        var expires = moment().add(7, 'days').valueOf();
        var token = jwt.encode({
            iss: req.systemId,
            sub: req.user.Username,
            exp: expires
        }, secret, 'HS512');

        return callback(token, expires);
    } else
        return callback();
}

/*
Middleware function for express which checks for a token in the
request header and if it matches to a user in the database
then attaches the user object to the request. If it doesn't match, or
token has expired, a 401 response is sent.
If no token is present, it checks if a system ID was supplied in the
header. If not, a 400 response is sent.
Arguments:
- req = Express HTTP Request object
- res = Express HTTP Response object
- next = Express next middleware function
*/
function parseSystemIdOrAccessToken(req, res, next) {
    if (req.headers.authorization) {
        var headerParts = req.headers.authorization.split(" ");
        var authType = headerParts[0];

        if (headerParts.length !== 2)
            return res.status(400).json({
                Error: "no_systemid_or_access_token"
            }).send();

        if (authType === "JWT") {
            var token = headerParts[1];
            try {
                var decoded = jwt.decode(token, secret);
                if (!decoded.exp || decoded.exp <= Date.now()) {
                    return res.status(401).json({
                        Error: "invalid_or_expired_token"
                    }).send();
                }
                dbUsers.getUserByUsername(decoded.iss, decoded.sub, function(err, user) {
                    if (err)
                        return res.status(500).send();
                    else if (user) {
                        req.systemId = user.SystemId;
                        req.system = user.System;
                        req.user = user;
                        return next();
                    } else {
                        return res.status(401).json({
                            Error: "invalid_or_expired_token"
                        }).send();
                    }
                });
            } catch (err) {
                return res.status(401).json({
                    Error: "invalid_or_expired_token"
                }).send();
            }
        } else if (authType === "SysId") {
            dbSystems.getSystem(headerParts[1], function(err, system) {
                if (err)
                    return res.status(500).send();
                else if (!system)
                    return res.status(400).json({
                        Error: "bad_systemid"
                    }).send();
                else {
                    req.systemId = system.SystemId;
                    req.system = system;
                    next();
                }
            });
        } else
            return res.status(400).json({
                Error: "no_systemid_or_access_token"
            }).send();
    } else
        return res.status(400).json({
            Error: "no_systemid_or_access_token"
        }).send();
}

/*
Function that checks this request is authenticated. If it isn't,
it responds with a 401 and the function returns false. If it is,
it doesn't touch the response, and the function returns true.
Arguments:
- req: Express HTTP Request object which has already passed through parseSystemIdOrAccessToken
- res: Express HTTP Response object
Returns:
- boolean: false if not authenticated and 401 was sent, or true if authenticated
*/
function checkAuthenticated(req, res) {
    if (req.user) return true;
    else {
        res.status(401).json({
            Error: "require_access_token"
        }).send();
        return false;
    }
}

/*
Function that checks if system is locked and whether user can override
this lock.  If it is locked and non-overrideable, it responds with a 401 
and the function returns false. If it isn't locked or the user is an
admin that can override it, it doesn't touch the response, and the function 
returns true.
Arguments:
- req: Express HTTP Request object which has already passed through parseSystemIdOrAccessToken
- res: Express HTTP Response object
Returns:
- boolean: true if operation can continue, false if operation should be halted
*/
function checkSystemUnlocked(req, res) {
    if (req.system.Lock) {
        if (req.user && req.user.Role.indexOf("admin") !== -1) return true;
        res.status(401).json({
            Error: "system_locked"
        }).send();
        return false;
    }
    return true;
}

exports.authenticateUser = authenticateUser;
exports.renewLogin = renewLogin;
exports.parseSystemIdOrAccessToken = parseSystemIdOrAccessToken;
exports.checkAuthenticated = checkAuthenticated;
exports.checkSystemUnlocked = checkSystemUnlocked;