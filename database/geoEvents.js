'use strict';

/*
Handles database interactions to do with GeoEvents.
*/

var db = require('./dynamodb').db;
var dbEvents = require('./events');
var dbVenueCounters = require('./venueCounters');
var dbEventCounters = require('./eventCounters');
var config = require('../utils/config');
var utils = require('../utils/utils');
var _ = require('lodash');

var tableName = config.tablePrefix + "GeoEvents";

/*
Creates the GeoEvents table schema.
Arguments:
- callback = function(err) : err is an error if one occurred
*/
function createSchema(callback) {
    console.log("Creating table " + tableName + "...");
    var params = {
        AttributeDefinitions: [{
            AttributeName: 'SystemId',
            AttributeType: 'S'
        }, {
            AttributeName: 'GeoEventId',
            AttributeType: 'S'
        }],
        KeySchema: [{
            AttributeName: 'SystemId',
            KeyType: 'HASH'
        }, {
            AttributeName: 'GeoEventId', // 'DeviceId#VenueId'
            KeyType: 'RANGE'
        }],
        ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1
        },
        TableName: tableName
    };

    db.createTable(params, function(err, data) {
        if (err) {
            if (err.message.indexOf("Table already exists") !== -1) {
                console.log("> Table already exists");
                return callback();
            } else {
                console.log("> Error", err, err.stack);
                return callback(err);
            }
        } else
            checkIfTableActive();
    });

    function checkIfTableActive() {
        db.describeTable({
            TableName: tableName
        }, function(err, data) {
            if (err) {
                console.log("> Error checking new table", err, err.stack);
                return callback(err);
            } else if (data.Table.TableStatus === "ACTIVE") {
                console.log("> Table now active");
                return callback();
            } else
                setTimeout(checkIfTableActive, 1000);
        });
    }
}

/*
Destroys the GeoEvents table schema.
Arguments:
- callback = function(err) : err is an error if one occurred
*/
function deleteSchema(callback) {
    console.log("Deleting table " + tableName + "...");
    var params = {
        TableName: tableName
    };

    db.deleteTable(params, function(err, data) {
        if (err) return callback(err);
        else checkIfTableNotExists();
    });

    function checkIfTableNotExists() {
        db.describeTable(params, function(err, data) {
            if (err) {
                if (err.code === 'ResourceNotFoundException') {
                    console.log('> Table deleted');
                    return callback();
                } else {
                    console.log('> Error checking table', err, err.stack);
                    return callback(err);
                }
            } else
                setTimeout(checkIfTableNotExists, 1000);
        });
    }
}

/*
Puts a new geo-event in the database.
Arguments:
- systemId = string : the system ID to create the agenda for
- geoEvent = object : object consisting of DeviceId, Time, VenueId
- callback = function(err) : err is the error if one occurred
*/
function putGeoEventEntry(systemId, geoEvent, callback) {
    var params = {
        Item: {
            SystemId: {
                S: systemId
            },
            GeoEventId: {
                S: geoEvent.DeviceId + '#' + geoEvent.VenueId
            },
            Time: {
                N: geoEvent.Time.toString()
            }
        },
        TableName: tableName,
        ConditionExpression: 'attribute_not_exists(#Time) OR (:newTime >= #Time)',
        ExpressionAttributeNames: {
            '#Time': 'Time'
        },
        ExpressionAttributeValues: {
            ':newTime': {
                N: (geoEvent.Time - 15 * utils.MILLIS_IN_MINUTE).toString()
            }
        }
    };
    db.putItem(params, function(err, data) {
        if (err && err.code !== 'ConditionalCheckFailedException')
            console.log('ERROR (putGeoEventEntry)', err, err.stack);
        callback(err, data); // callback regardless
        if (!err) { // if no error, update counters after calling back
            getPossibleEventOccIds(function(err, eventOccurrences) {
                if (!err && eventOccurrences.length > 0) {
                    // only increment if there are events. async functions, but don't care about result, so can call "sequentially"
                    dbVenueCounters.incrementVenueCounter(systemId, geoEvent);
                    dbEventCounters.incrementEventCounters(systemId, {
                        Time: geoEvent.Time,
                        Occurrences: eventOccurrences
                    });
                }
            });
        }
    });

    function getPossibleEventOccIds(cb) {
        var allowance = 10 * utils.MILLIS_IN_MINUTE;

        var filter = {
            FilterExpression: '(#Start <= :lowerLimit) AND (:time <= #End)',
            ExpressionAttributeNames: {
                '#Start': 'Start',
                '#End': 'End'
            },
            ExpressionAttributeValues: {
                ':lowerLimit': {
                    N: (geoEvent.Time + allowance).toString()
                },
                ':time': {
                    N: geoEvent.Time.toString()
                }
            }
        };

        var projectionExpression = 'OccurrenceId, EventId, Contributor';

        dbEvents.getFilteredEventOccurrencesByVenueId(systemId, geoEvent.VenueId, projectionExpression, filter, cb);
    }    
}

exports.createSchema = createSchema;
exports.deleteSchema = deleteSchema;
exports.putGeoEventEntry = putGeoEventEntry;
