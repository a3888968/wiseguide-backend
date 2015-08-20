"use strict";

/*
This module contains utility functions for handling user objects
*/

var validator = require('validator');

/*
Strips down a user object to those suitable for a private_user response 
(i.e. contains more sensitive info like email address)
Removes password, system ID
Arguments:
- user = object : the object to strip down
Returns
- privateUser = object : stripped down object
*/
function convertToPrivateUser(user) {
    return {
        Username: user.Username,
        Email: user.Email,
        Name: user.Name,
        Biography: user.Biography,
        Summary: user.Summary,
        Role: user.Role
    };
}

/*
Strips down a user object to those suitable for a public user response 
(i.e. does NOT contain more sensitive info like email address)
Removes password, system ID
Arguments:
- user = object : the object to strip down
Returns
- publicUser = object : stripped down object
*/
function convertToPublicUser(user) {
    return {
        Username: user.Username,
        Name: user.Name,
        Biography: user.Biography,
        Summary: user.Summary,
        Role: user.Role
    };
}

/*
Validates the properties of a user object.
Arguments:
- user = object : the object to validate
- requireFields = boolean : set to true to require all properties to be 
							present, false to allow some to be missing
Returns:
null if valid, or a string describing the validation error if invalid
*/
function validateUserProperties(user, requireFields) {
    var noLeftTrimProps = ['Biography', 'Summary'];
    for (var prop in user) { // trim properties (except Password)
        if (typeof user[prop] === 'string' && prop !== 'Password')
        // if prop in this list, only trim right
            user[prop] = noLeftTrimProps.indexOf(prop) !== -1 ? user[prop].trimRight() : user[prop].trim();
    }

    if ((user.hasOwnProperty('Password') || requireFields) &&
        !(typeof user.Password === "string" &&
            user.Password.length >= 8 &&
            /\d/.test(user.Password) &&
            /[a-zA-Z]/.test(user.Password)))
        return "bad_password";

    if ((user.hasOwnProperty('Email') || requireFields) &&
        !(typeof user.Email === 'string' && validator.isEmail(user.Email)))
        return "bad_email";

    if ((user.hasOwnProperty('Username') || requireFields) &&
        !(typeof user.Username === 'string' &&
            user.Username.length >= 3 &&
            user.Username.length <= 15 &&
            validator.isAlphanumeric(user.Username)))
        return "bad_username";

    if ((user.hasOwnProperty('Name') || requireFields) &&
        !(typeof user.Name === "string" &&
            user.Name.length >= 1 &&
            user.Name.length <= 30))
        return "bad_name";

    if ((user.hasOwnProperty('Biography') || requireFields) &&
        !(typeof user.Biography === "string" &&
            user.Biography.length >= 1))
        return "bad_biography";

    if ((user.hasOwnProperty('Summary') || requireFields) &&
        !(typeof user.Summary === "string" &&
            user.Summary.length >= 1))
        return "bad_summary";
}

exports.convertToPrivateUser = convertToPrivateUser;
exports.convertToPublicUser = convertToPublicUser;
exports.validateUserProperties = validateUserProperties;