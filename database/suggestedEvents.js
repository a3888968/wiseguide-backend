'use strict';

/*
Handles database interactions to do with suggested similar events. 
Each item represents an event and a list of events similar to it.
*/

var _ = require('lodash');
var db = require('./dynamodb').db;
var dbEvents = require('./events');
var dbAgendaItems = require('./agendaItems');
var config = require('../utils/config');

var tableName = config.tablePrefix + "SuggestedEvents";

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
            AttributeName: 'EventId',
            AttributeType: 'S'
        }],
        KeySchema: [{
            AttributeName: 'SystemId',
            KeyType: 'HASH'
        }, {
            AttributeName: 'EventId',
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
Gets suggested similar events for an event ID, sorted by similarity rating
*/
function getSuggestedEvents(systemId, eventId, callback) {
    var params = {
        Key: {
            SystemId: {
                S: systemId
            },
            EventId: {
                S: eventId
            }
        },
        TableName: tableName
    };
    db.getItem(params, function(err, data) {
        if (err) {
            console.log("ERROR (getSimilarEvents)", err, err.stack);
            return callback(err);
        }

        var similar = [];
        if (data && data.Item && data.Item.Suggestions && data.Item.Suggestions.SS) {
            var eventRatings = {};
            var eventIds = [];
            for (var i = 0; i < 3 && i < data.Item.Suggestions.SS.length; i++) {
                var split = data.Item.Suggestions.SS[i].split('#');
                eventRatings[split[0]] = parseFloat(split[1]);
                eventIds.push(split[0]);
            }
            dbEvents.getEventsByEventIds(systemId, eventIds, function(err, evs) {
                if (err)
                    return callback(err);
                else {
                    _.each(evs, function(ev) {
                        ev.Rating = eventRatings[ev.EventId];
                        similar.push(ev);
                    });
                    similar.sort(function(a, b) {
                        return a.Rating - b.Rating;
                    });
                    return callback(undefined, similar);
                }
            });
        } else {
            return callback(undefined, []);
        }
    });
}

/*
Gets suggested similar events for an agenda ID, sorted by similarity rating
*/
function getSuggestedEventsForAgenda(systemId, agendaId, callback) {
    var suggs = {};

    dbAgendaItems.getEventOccurrencesByAgendaId(systemId, agendaId, function(err, occs) {
        if (err) {
            return callback(err);
        } else if (occs.length === 0) {
            return callback(undefined, []);
        } else {
            var allEventIds = _.map(occs, function(occ) { return occ.Event.EventId; });
            var keys = _.map(occs, function(occ) {
                return {
                    SystemId: {
                        S: systemId
                    },
                    EventId: {
                        S: occ.Event.EventId
                    }
                };
            });
            var params = {
                RequestItems: {}
            };
            params.RequestItems[tableName] = {
                Keys: keys
            };
            db.batchGetItem(params, function(err, data) {
                if (err)
                    return callback(err);

                if (data && data.Responses && data.Responses[tableName]) {
                    var responses = data.Responses[tableName];
                    for (var i = 0; i < responses.length; i++) {
                        if (responses[i].Suggestions && responses[i].Suggestions.SS) {
                            for (var j = 0; j < responses[i].Suggestions.SS.length; j++) {
                                var split = responses[i].Suggestions.SS[j].split('#');
                                if (allEventIds.indexOf(split[0]) === -1) {
                                    if (!suggs[split[0]])
                                        suggs[split[0]] = parseFloat(split[1]);
                                    else
                                        suggs[split[0]] += parseFloat(split[1]);
                                }
                            }
                        }
                    }
                }

                // TODO: handle any UnprocessedKeys (low priority for now)

                var sortable = [];
                for (var s in suggs) {
                    sortable.push([s, suggs[s]]);
                }
                sortable.sort(function(a, b) {
                    return b[1] - a[1];
                });

                var eventIds = _.map(_.take(sortable, 3), function(y) {
                    return y[0];
                });

                dbEvents.getEventsByEventIds(systemId, eventIds, function(err, evs) {
                    if (err)
                        return callback(err);
                    else
                        return callback(undefined, evs);
                });
            });
        }
    });
}

exports.createSchema = createSchema;
exports.deleteSchema = deleteSchema;
exports.getSuggestedEvents = getSuggestedEvents;
exports.getSuggestedEventsForAgenda = getSuggestedEventsForAgenda;