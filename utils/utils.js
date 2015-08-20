'use strict';

var config = require('./config');
var MILLIS_IN_MINUTE = 60000;
var timechunkIntervalInMillis = config.timechunkIntervalInMins * MILLIS_IN_MINUTE;

/**
 * Modify Object.prototype to have `hasKeys`
 *
 * Returns true if the target object has exactly the keys specified
 */
Object.defineProperty(Object.prototype, 'hasKeys', {
    value: function(keys) {
        if (!isArrayOfStrings(keys))
            throw new Error('expected the first and only argument to be an array of strings');
        var actual = Object.keys(this);
        return (actual.length === keys.length) &&
            actual.every(function(key) {
                return keys.indexOf(key) !== -1;
            });
    },
    configurable: true
});

/**
 * Modify Object.prototype to have `hasAllowedKeys`
 *
 * Returns true if the target object's keys are a subset of the keys specified
 */
Object.defineProperty(Object.prototype, 'hasAllowedKeys', {
    value: function(allowedKeys) {
        if (!isArrayOfStrings(allowedKeys))
            throw new Error('expected the first and only argument to be an array of strings');
        var actual = Object.keys(this);
        return (actual.length <= allowedKeys.length) &&
            actual.every(function(ownKey) {
                return allowedKeys.indexOf(ownKey) !== -1;
            });
    },
    configurable: true
});


/* 
A function which checks if an array of strings contains any duplicates.
Returns true if it contains duplicates, false otherwise.
[Credit: http://stackoverflow.com/a/7376645]
*/
function stringArrayHasDuplicates(array) {
    var valuesSoFar = {};
    for (var i = 0; i < array.length; ++i) {
        var value = array[i];
        if (Object.prototype.hasOwnProperty.call(valuesSoFar, value)) {
            return true;
        }
        valuesSoFar[value] = true;
    }
    return false;
}

/*
A function which returns whether or not an object is an array of strings.
Returns true if the object is an array and every element is of type string, false otherwise.
Note: returns true for an empty array.
*/
function isArrayOfStrings(obj) {
    return Array.isArray(obj) && obj.every(function(x) {
        return typeof x === 'string';
    });
}

/*
Convert angle in degrees to an angle in radians.
*/
function toRadians(numInDegrees) {
    return numInDegrees * Math.PI / 180;
}

/*
Get the distance between two geo-coordinates.
Arguments:
- lat1 = float: latitude of first geo-coordinate
- lon1 = float: longitude of first geo-coordinate
- lat2 = float: latitude of second geo-coordinate
- lon2 = float: longitude of first geo-coordinate
Returns
- distance = float: geographic distance between (lat1,lon1) and (lat2,lon2)
*/
function getDistance(lat1, lon1, lat2, lon2) {
    // Adapted from http://www.movable-type.co.uk/scripts/latlong.html
    var radius = 6371e3;
    var R = radius;
    var φ1 = toRadians(lat1),
        λ1 = toRadians(lon1);
    var φ2 = toRadians(lat2),
        λ2 = toRadians(lon2);
    var Δφ = φ2 - φ1;
    var Δλ = λ2 - λ1;

    var a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;

    return d;
}

/*
Rounds a UNIX timestamp in milliseconds up, down or to the nearest timechunk boundary
Arguments:
- time - int: UNIX timestamp in milliseconds to round
- method - string: 'up', 'down' or 'nearest'. Defaults to 'nearest' if not specified
Returns
- rounded - int: rounded UNIX timestamp in milliseconds
*/
function roundToTimechunk(time, method) {
    method = method || 'nearest';
    switch (method) {
        case 'up':
            time = Math.ceil(time / timechunkIntervalInMillis);
            break;
        case 'down':
            time = Math.floor(time / timechunkIntervalInMillis);
            break;
        default: // 'nearest'
            time = Math.round(time / timechunkIntervalInMillis);
            break;
    }
    return (time * timechunkIntervalInMillis);
}

exports.stringArrayHasDuplicates = stringArrayHasDuplicates;
exports.isArrayOfStrings = isArrayOfStrings;
exports.getDistance = getDistance;
exports.MILLIS_IN_MINUTE = MILLIS_IN_MINUTE;
exports.timechunkIntervalInMillis = timechunkIntervalInMillis;
exports.roundToTimechunk = roundToTimechunk;
