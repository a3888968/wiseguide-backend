"use strict";

/* 
This module handles endpoints regarding users. All endpoints begin /api/users
*/

var express = require('express');
var dbUsers = require('../database/users');
var utilsUsers = require('../users/utils');
var auth = require('../users/authentication');
var hash = require('../users/hash');
var router = express.Router();
var validator = require('validator');
var utils = require('../utils/utils');

/*
Handles a login request. Checks request is well formed, determines
if an email or a username was supplied, makes the required database lookup,
then generates a token for the user.
*/
router.post('/login', function(req, res) {
    var user = req.body;

    if (req.headers['content-type'] != "application/json")
        return res.status(400).json({
            Error: "wrong_content_type"
        }).send();

    if (!(user.hasKeys(['Username', 'Password']) &&
        typeof user.Username === 'string' && user.Username &&
        typeof user.Password === 'string' && user.Password))
        return res.status(400).json({
            Error: "invalid_parameters"
        }).send();

    if (validator.isEmail(req.body.Username))
        dbUsers.getUserByEmail(req.systemId, req.body.Username, finishAuth);
    else
        dbUsers.getUserByUsername(req.systemId, req.body.Username, finishAuth);

    function finishAuth(err, user) {
        if (err)
            return res.status(500).send();
        else if (!user)
            return res.status(401).send();
        else {
            auth.authenticateUser(user, req.body.Password, function(token, expires) {
                if (token) {
                    return res.status(200).json({
                        Token: token,
                        Expires: expires,
                        User: utilsUsers.convertToPrivateUser(user)
                    }).send();
                } else
                    return res.status(401).send();
            });
        }
    }
});

/*
Creates a new user account. First validates, then puts the user into the database
and if successful generates a token.
*/
router.post('/signup', function(req, res) {
    if (!auth.checkSystemUnlocked(req, res)) return;

    if (req.headers['content-type'] != "application/json")
        return res.status(400).json({
            Error: "wrong_content_type"
        }).send();

    var user = req.body;
    var clearPassword = user.Password;

    if (!user.hasKeys(['Username', 'Email', 'Password', 'Name', 'Biography', 'Summary']))
        return res.status(400).json({
            Error: "invalid_parameters"
        }).send();

    var validationError = utilsUsers.validateUserProperties(user, true);
    if (validationError)
        return res.status(400).json({
            Error: validationError
        }).send();

    user.Password = hash.hashPassword(user.Password);
    user.Role = ["contributor"];
    user.SystemId = req.systemId;

    dbUsers.putUser(req.systemId, user, req.system, function(err, data) {
        if (err) {
            if (err === "username_exists" || err === "email_exists")
                return res.status(400).json({
                    Error: err
                }).send();
            else
                return res.status(500).send();
        } else {
            auth.authenticateUser(user, clearPassword, function(token, expires) {
                return res.status(200).json({
                    Token: token,
                    Expires: expires,
                    User: utilsUsers.convertToPrivateUser(user)
                }).send();
            });
        }
    });
});

/*
Modifies a user in the database. First checks input is well-formed (using same
criteria as /signup) then updates the user in the database.
*/
router.post('/edit', function(req, res) {
    if (!auth.checkAuthenticated(req, res)) return;

    if (req.headers['content-type'] != "application/json")
        return res.status(400).json({
            Error: "wrong_content_type"
        }).send();

    var user = req.body;

    if (!user.hasAllowedKeys(['Email', 'NewPassword', 'CurrentPassword', 'Name', 'Biography', 'Summary']))
        return res.status(400).json({
            Error: "invalid_parameters"
        }).send();

    if (user.NewPassword) {
        if (!(user.CurrentPassword &&
            hash.checkPassword(user.CurrentPassword, req.user.Password))) {
            return res.status(400).json({
                Error: "wrong_password"
            }).send();
        } else {
            user.Password = user.NewPassword;
            user.NewPassword = undefined;
            user.CurrentPassword = undefined;
        }
    }

    var validationError = utilsUsers.validateUserProperties(user, false);
    if (validationError)
        return res.status(400).json({
            Error: validationError
        }).send();

    if (user.Password)
        user.Password = hash.hashPassword(user.Password);

    dbUsers.updateUser(req.systemId, req.user.Username, user, function(err, data) {
        if (err) {
            if (err === "email_exists")
                return res.status(400).json({
                    Error: err
                }).send();
            else
                return res.status(500).send();
        } else
            return res.status(200).send();
    });
});

/*
Deletes a user from the database. First checks user being deleted is logged in
user or an admin. Then deletes the specified user
*/
router.post('/delete/:username', function(req, res) {
    if (!auth.checkAuthenticated(req, res)) return;
    if (!auth.checkSystemUnlocked(req, res)) return;

    if (req.user.Username === req.params.username || req.user.Role.indexOf("admin") !== -1) {
        dbUsers.deleteUser(req.systemId, req.params.username, function(err, data) {
            if (err)
                return res.status(500).send();
            else
                return res.status(200).send();
        });
    } else
        return res.status(401).json({
            Error: "not_permitted"
        }).send();
});

/*
Look up the details of a user by their username. Will only return details if
the request is authenticated.
*/
router.get('/details/:username', function(req, res) {
    if (!auth.checkAuthenticated(req, res)) return;

    dbUsers.getUserByUsername(req.systemId, req.params.username, function(err, user) {
        if (err)
            return res.status(500).send();
        else if (!user)
            return res.status(404).json({
                Error: "user_not_found"
            }).send();
        else {
            return res.status(200).json(utilsUsers.convertToPublicUser(user)).send();
        }
    });
});

/*
Generates a fresh token for the logged in user and returns their details
(if they are logged in with a valid non-expired token)
*/
router.get('/renew', function(req, res) {
    if (!auth.checkAuthenticated(req, res)) return;

    auth.renewLogin(req, function(token, expires) {
        if (token) {
            return res.status(200).json({
                Token: token,
                Expires: expires,
                User: utilsUsers.convertToPrivateUser(req.user)
            }).send();
        } else
            return res.status(401).send();
    });
});


module.exports = router;