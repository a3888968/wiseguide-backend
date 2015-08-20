'use strict';

/*
Handles database interactions to do with Event counters.
*/

var db = require('./dynamodb').db;
var dbEvents = require('./events');
var config = require('../utils/config');
var utils = require('../utils/utils');
var _ = require('lodash');
var async = require('async');

var tableName = config.tablePrefix + 'EventCounters';

/*
Creates the EventCounters table schema.
Arguments:
- callback = function(err) : err is an error if one occurred
*/
function createSchema(callback) {
    console.log('Creating table ' + tableName + '...');
    var params = {
        AttributeDefinitions: [{
            AttributeName: 'SysEventId', // SystemId#EventId
            AttributeType: 'S'
        }, {
            AttributeName: 'OccIdTime', // OccurrenceId#Time
            AttributeType: 'S'
        }, {
            AttributeName: 'SystemId',
            AttributeType: 'S'
        }, {
            AttributeName: 'EventId',
            AttributeType: 'S'
        }],
        KeySchema: [{
            AttributeName: 'SysEventId',
            KeyType: 'HASH'
        }, {
            AttributeName: 'OccIdTime',
            KeyType: 'RANGE'
        }],
        GlobalSecondaryIndexes: [{
            IndexName: 'EventIdGlIndex',
            KeySchema: [{
                AttributeName: 'SystemId',
                KeyType: 'HASH'
            }, {
                AttributeName: 'EventId',
                KeyType: 'RANGE'
            }],
            Projection: {
                ProjectionType: 'ALL'
            },
            ProvisionedThroughput: {
                ReadCapacityUnits: 1,
                WriteCapacityUnits: 2
            }
        }],
        ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 2
        },
        TableName: tableName
    };

    db.createTable(params, function(err, data) {
        if (err) {
            if (err.message.indexOf('Table already exists') !== -1) {
                console.log('> Table already exists');
                return callback();
            } else {
                console.log('> Error', err, err.stack);
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
                console.log('> Error checking new table', err, err.stack);
                return callback(err);
            } else if (data.Table.TableStatus === 'ACTIVE') {
                console.log('> Table now active');
                return callback();
            } else
                setTimeout(checkIfTableActive, 1000);
        });
    }
}

/*
Destroys the VenueCounters table schema.
Arguments:
- callback = function(err) : err is an error if one occurred
*/
function deleteSchema(callback) {
    console.log('Deleting table ' + tableName + '...');
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
Increments counters for potential event occurrences at a particular venue and time
Arguments:
- systemId = string : the system ID to increment counters for
- info = object : object consisting of Time, Occurrences (array containing EventId and OccurrenceId)
- callback = function(err) : err is the error if one occurred
*/
function incrementEventCounters(systemId, info, cb) {
    cb = cb || function() {};
    async.eachSeries(info.Occurrences, function(occ, cb) {
        var params = {
            Key: {
                SysEventId: {
                    S: systemId + '#' + occ.Event.EventId
                },
                OccIdTime: {
                    S: occ.OccurrenceId + '#' + utils.roundToTimechunk(info.Time, 'down')
                }
            },
            TableName: tableName,
            UpdateExpression: 'SET SystemId = :sysId, EventId = :evId, #Count = if_not_exists(#Count, :zero) + :inc',
            ExpressionAttributeNames: {
                '#Count': 'Count'
            },
            ExpressionAttributeValues: {
                ':sysId': {
                    S: systemId
                },
                ':evId': {
                    S: occ.Event.EventId
                },
                ':inc': {
                    N: '1'
                },
                ':zero': {
                    N: '0'
                }
            }
        };
        db.updateItem(params, function(err, data) {
            if (err) console.log('ERROR (incrementEventCounters)', err, err.stack);
            return cb(null, data); // purposefully omit error
        });
    }, cb);
}

/*
Returns a list of popular events
Arguments:
- systemId = string : the system ID to get popular events for
- callback = function(err, events) : err is the error if one occurred,
                                     events is an array (sorted by Total in descending order) containing objects with properties
                                            EventId [string]
                                            Name [string] - event name
                                            Total [int] - total number of potential visits for this particular event
                                            TimeCounts [array] - array (sorted by Time in ascending order) containing properties
                                                Time [int] - unix timestamp in millis, denoting the start boundary of a timechunk
                                                Count [int] - total number of visits during this timechunk
*/
function getPopularEvents(systemId, cb) {
    var LIMIT = 5;
    var occs = [];
    get();

    function get(lastEvaluatedKey) {
        var params = {
            KeyConditions: {
                SystemId: {
                    ComparisonOperator: 'EQ',
                    AttributeValueList: [{
                        S: systemId
                    }]
                }
            },
            ExclusiveStartKey: lastEvaluatedKey,
            TableName: tableName,
            IndexName: 'EventIdGlIndex',
        };

        db.query(params, function(err, data) {
            if (err) {
                console.log('ERROR (getPopularEvents)', err, err.stack);
                return cb(err);
            }

            if (data && data.Items)
                data.Items.forEach(function(item) {
                    occs.push(convertDatabaseItemToEventOccurrence(item));
                });

            if (data.LastEvaluatedKey)
                return get(data.LastEvaluatedKey);
            if (occs.length === 0)
                return cb(null, []);
            return processEventOccurrences();
        });
    }

    function processEventOccurrences() {
        var events = _.reduce(occs, function(acc, occurrence) {
            var evt = acc[occurrence.EventId] = acc[occurrence.EventId] || {
                Total: 0,
                TimeCounts: []
            };
            evt.Total += occurrence.Count;
            evt.TimeCounts.push({
                Time: occurrence.Time,
                Count: occurrence.Count
            });
            return acc;
        }, {});

        var eventIds = [],
            sliceLimit = 0, ranking = 0;

        events = _(events)
            .map(function(evt, id) {
                evt.EventId = id;
                return evt;
            }).sortByOrder('Total', false)
            .forEach(function(evt, index, array) {
                if (index === 0 || (array[index-1].Total > evt.Total)) {
                    if (ranking === LIMIT) return false;
                    ranking++;
                }
                sliceLimit++;
            }).thru(function(array) {
                return array.slice(0, sliceLimit);
            }).forEach(function(evt) {
                evt.TimeCounts = _.sortBy(evt.TimeCounts, 'Time');
                eventIds.push(evt.EventId);
            }).value();

        // retrieve extra info (Name) for each eventId
        dbEvents.getEventsByEventIds(systemId, eventIds, function(err, occurrences) {
            if (err) return cb(err);

            var extraEventInfo = _.reduce(occurrences, function(acc, occ) {
                acc[occ.EventId] = {
                    Name: occ.Name
                };
                return acc;
            }, {});
            _.forEach(events, function(evt) {
                _.assign(evt, extraEventInfo[evt.EventId]);
            });
            return cb(null, events);
        });  
    }
}

/*
Converts a database Item to an event occurrence object by extracting the relevant
properties (EventId, OccurenceId, Time and Count)
but also adds the Time and Count properties
Arguments:
- item: the database Item to convert
Returns:
- eventObj: the converted event occurrence object
*/
function convertDatabaseItemToEventOccurrence(item) {
    var eventObj = {};
    if (item.EventId) eventObj.EventId = item.EventId.S;
    if (item.OccIdTime) {
        var parts = item.OccIdTime.S.split('#');
        eventObj.OccurrenceId = parts[0];
        eventObj.Time = parseInt(parts[1]);
    }
    if (item.Count) eventObj.Count = parseInt(item.Count.N);
    return eventObj;
}

exports.createSchema = createSchema;
exports.deleteSchema = deleteSchema;
exports.incrementEventCounters = incrementEventCounters;
exports.getPopularEvents = getPopularEvents;
