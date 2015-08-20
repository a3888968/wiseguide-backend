"use strict";

/*
This module is a utility which can hash new passwords and check the validity
of a plaintext password against its stored hash.
*/

var bcrypt = require('bcrypt');

/*
Hashes a password.
Arguments:
- password = string : plaintext password to hash
Returns:
- hash = string : the hashed/salted password
*/
function hashPassword(password) {
    var salt = bcrypt.genSaltSync(10);
    var hash = bcrypt.hashSync(password, salt);
    return hash;
}

/*
Checks a plaintext password against a hashed one to check if it matches
Arguments:
- password = string : plaintext password to hash
- hash = string : the hashed/salted password
Returns:
- boolean: true if password/hash match, false otherwise
*/
function checkPassword(password, hash) {
    try {
        return bcrypt.compareSync(password, hash);
    } catch (err) {
        console.log(err.stack);
        return false;
    }
}

exports.hashPassword = hashPassword;
exports.checkPassword = checkPassword;