'use strict';

/*
Handles database interactions to do with Venue counters.
*/

var db = require('./dynamodb').db;
var dbVenues = require('./venues');
var config = require('../utils/config');
var utils = require('../utils/utils');
var _ = require('lodash');
var async = require('async');

var tableName = config.tablePrefix + 'VenueCounters';

/*
Creates the VenueCounters table schema.
Arguments:
- callback = function(err) : err is an error if one occurred
*/
function createSchema(callback) {
    console.log('Creating table ' + tableName + '...');
    var params = {
        AttributeDefinitions: [{
            AttributeName: 'SysVenueId',
            AttributeType: 'S'
        }, {
            AttributeName: 'Time',
            AttributeType: 'N'
        }, {
            AttributeName: 'SystemId',
            AttributeType: 'S'
        }, {
            AttributeName: 'VenueId',
            AttributeType: 'S'
        }],
        KeySchema: [{
            AttributeName: 'SysVenueId', // 'SystemId#VenueId'
            KeyType: 'HASH'
        }, {
            AttributeName: 'Time', // time chunk (e.g. 9am if the chunk is 9am-9.30am). End is implicitly 30 minutes. Stored in milliseconds
            KeyType: 'RANGE'
        }],
        GlobalSecondaryIndexes: [{
            IndexName: 'VenueIdGlIndex',
            KeySchema: [{
                AttributeName: 'SystemId',
                KeyType: 'HASH'
            }, {
                AttributeName: 'VenueId',
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
Increments the counter for a particular venue
Arguments:
- systemId = string : the system ID to increment the venue counter for
- info = object : object consisting of VenueId, Time
- callback = function(err) : err is the error if one occurred
*/
function incrementVenueCounter(systemId, info, cb) {
    cb = cb || function() {};
    var params = {
        Key: {
            SysVenueId: {
                S: systemId + '#' + info.VenueId
            },
            Time: {
                N: utils.roundToTimechunk(info.Time, 'down').toString()
            }
        },
        TableName: tableName,
        UpdateExpression: 'SET SystemId = :sysId, VenueId = :venId, #Count = if_not_exists(#Count, :zero) + :inc',
        ExpressionAttributeNames: {
            '#Count': 'Count'
        },
        ExpressionAttributeValues: {
            ':sysId': {
                S: systemId
            },
            ':venId': {
                S: info.VenueId
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
        if (err) console.log('ERROR (incrementVenueCounter)', err, err.stack);
        return cb(err, data);
    });
}

/*
Returns a list of popular venues
Arguments:
- systemId = string : the system ID to get popular venues for
- callback = function(err, venues) : err is the error if one occurred,
                                     venues is an array (sorted by Total in descending order) containing objects with properties
                                            VenueId [string]
                                            Name [string] - venue name
                                            Total [int] - total number of visits for this particular venue
                                            TimeCounts [array] - array (sorted by Time in ascending order) containing properties
                                                Time [int] - unix timestamp in millis, denoting the start boundary of a timechunk
                                                Count [int] - total number of visits during this timechunk
*/
function getPopularVenues(systemId, cb) {
    var LIMIT = 5;
    var venues = [];
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
            IndexName: 'VenueIdGlIndex',
        };

        db.query(params, function(err, data) {
            if (err) {
                console.log('ERROR (getPopularVenues)', err, err.stack);
                return cb(err);
            }

            if (data && data.Items)
                data.Items.forEach(function(venueItem) {
                    venues.push(convertDatabaseItemToVenue(venueItem));
                });

            if (data.LastEvaluatedKey)
                return get(data.LastEvaluatedKey);
            if (venues.length === 0)
                return cb(null, []);
            return processVenues();
        });
    }

    function processVenues() {
        var processedVenues = _.reduce(venues, function(acc, venue) {
            var ven = acc[venue.VenueId] = acc[venue.VenueId] || {
                Total: 0,
                TimeCounts: []
            };
            ven.Total += venue.Count;
            ven.TimeCounts.push({
                Time: venue.Time,
                Count: venue.Count
            });
            return acc;
        }, {});

        var keys = [],
            sliceLimit = 0, ranking = 0;

        processedVenues = _(processedVenues)
            .map(function(venue, id) {
                venue.VenueId = id;
                return venue;
            }).sortByOrder('Total', false)
            .forEach(function(venue, index, array) {
                if (index === 0 || (array[index-1].Total > venue.Total)) {
                    if (ranking === LIMIT) return false;
                    ranking++;
                }
                sliceLimit++;
            }).thru(function(array) {
                return array.slice(0, sliceLimit);
            }).forEach(function(venue) {
                venue.TimeCounts = _.sortBy(venue.TimeCounts, 'Time');
                keys.push({
                    SystemId: {
                        S: systemId
                    },
                    VenueId: {
                        S: venue.VenueId
                    }
                });
            }).value();

        // retrieve extra info (Name, Lat, Lon) for each venueId
        var params = {
            RequestItems: {}
        };
        params.RequestItems[dbVenues.tableName] = {
            Keys: keys,
            ProjectionExpression: 'VenueId, #Name, Lat, Lon',
            ExpressionAttributeNames: {
                '#Name': 'Name'
            }
        };

        db.batchGetItem(params, function(err, data) {
            if (err) {
                console.log('ERROR (getPopularVenues:processVenues:batchGetItem)', err, err.stack);
                return cb(err);
            }
            if (data && data.Responses && data.Responses[dbVenues.tableName]) {
                var extraVenueInfo = _.reduce(data.Responses[dbVenues.tableName], function(acc, item) {
                    acc[item.VenueId.S] = dbVenues.convertDatabaseItemToVenue(item);
                    return acc;
                }, {});
                _.forEach(processedVenues, function(venue) {
                    _.assign(venue, extraVenueInfo[venue.VenueId]);
                });
            }
            if (data.UnprocessedKeys[dbVenues.tableName])
                return cb('UnprocessedKeys');
            // TODO handle data.UnprocessedKeys
            return cb(null, processedVenues);
        });        
    }
}

/*
Internally calls dbVenues.convertDatabaseItemToVenue(item),
but also adds the Time and Count properties
Arguments:
- item: the database Item to convert
Returns:
- venue: the converted venue object
*/
function convertDatabaseItemToVenue(item) {
    var venue = dbVenues.convertDatabaseItemToVenue(item);
    if (item.Time) venue.Time = parseInt(item.Time.N);
    if (item.Count) venue.Count = parseInt(item.Count.N);
    return venue;
}

exports.createSchema = createSchema;
exports.deleteSchema = deleteSchema;
exports.incrementVenueCounter = incrementVenueCounter;
exports.getPopularVenues = getPopularVenues;
