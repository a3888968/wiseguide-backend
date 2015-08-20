'use strict';

/*
Handles database interactions to do with Agenda Items.
*/

var db = require('./dynamodb').db;
var dbEvents = require('../database/events');
var config = require('../utils/config');
var _ = require('lodash');
var async = require('async');

var tableName = config.tablePrefix + "AgendaItems";

/*
Creates the Agenda Items table schema.
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
        	AttributeName: 'AgendaItemId', // AgendaId + '#' + OccurrenceId
            AttributeType: 'S'
        }, {
            AttributeName: 'OccurrenceId',
            AttributeType: 'S'
        }, {
            AttributeName: 'EventId',
            AttributeType: 'S'
        }],
        KeySchema: [{
            AttributeName: 'SystemId',
            KeyType: 'HASH'
        }, {
            AttributeName: 'AgendaItemId',
            KeyType: 'RANGE'
        }],
        LocalSecondaryIndexes: [{
            IndexName: 'OccurrenceIdIndex',
            KeySchema: [{
                AttributeName: 'SystemId',
                KeyType: 'HASH'
            }, {
                AttributeName: 'OccurrenceId',
                KeyType: 'RANGE'
            }],
            Projection: {
                ProjectionType: 'ALL'
            }
        }, {
            IndexName: 'EventIdIndex',
            KeySchema: [{
                AttributeName: 'SystemId',
                KeyType: 'HASH'
            }, {
                AttributeName: 'EventId',
                KeyType: 'RANGE'
            }],
            Projection: {
                ProjectionType: 'ALL'
            }
        }], // no index for AgendaId for now, will add if needed
        ProvisionedThroughput: {
            ReadCapacityUnits: 2,
            WriteCapacityUnits: 2
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
Destroys the Agendas table schema.
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
Adds a new agenda item (containing an event occurrence) to an existing agenda
Arguments:
- systemId = string : the system ID
- agendaId = string : the agenda ID to add entry for
// TODO change it to be just occurrence ID or agendaItem JS object, move the logic in here
- occurrence = object : a DynamoDB object representing an occurrence
- callback = function(err) : err is the error if one occurred
*/
function putAgendaItem(systemId, agendaId, occurrence, callback) {
    var params = {
        Item: {
            SystemId: {
                S: systemId
            },
            AgendaItemId: {
                S: agendaId + '#' + occurrence.OccurrenceId.S
            },
            OccurrenceId: {
                S: occurrence.OccurrenceId.S
            },
            EventId: {
                S: occurrence.EventId.S
            },
            Start: {
                N: occurrence.Start.N
            },
            Occurrence: {
            	M: occurrence
            }
        },
        TableName: tableName,
        Expected: {
            SystemId: {
                Exists: false
            },
            AgendaItemId: {
                Exists: false
            }
        }
    };
    db.putItem(params, function(err, data) {
        if (err) {
            if (err.code === 'ConditionalCheckFailedException')
                return callback('condition_violated');

            console.log("ERROR (putAgenda)", err, err.stack);
            return callback(err, data);
        } else {
            return callback(err, data);
        }
    });
}

/*
Gets a list of all event occurrences in the database that are in a specific agenda.
This function does NOT expose pagination (though it will automatically retrieve extra pages internally)
Arguments:
- systemId = string : the system ID the query pertains to
- agendaId = string : the agenda ID to find occurrences by
- callback = function(err, eventOccurrences) : 
                err is the error if one occurred;
                eventOccurrences is a list of event occurrences sorted by start time
*/
function getEventOccurrencesByAgendaId(systemId, agendaId, cb) {
    var eventOccurrences = [];
    return get();

    function get(lastEvaluatedKey) {
        var params = {
            KeyConditions: {
                SystemId: {
                    ComparisonOperator: 'EQ',
                    AttributeValueList: [{
                        S: systemId
                    }]
                },
                AgendaItemId: {
                    ComparisonOperator: 'BEGINS_WITH',
                    AttributeValueList: [{
                        S: agendaId + '#'
                    }]
                }
            },
            ExclusiveStartKey: lastEvaluatedKey,
            TableName: tableName,
        };
        db.query(params, function(err, data) {
            if (err) {
                console.log("ERROR (getEventOccurrencesByAgendaId)", err, err.stack);
                return cb(err);
            }
            if (data && data.Items)
                data.Items.forEach(function(agendaItem) {
                    eventOccurrences.push(convertDatabaseItemToEventOccurrence(agendaItem.Occurrence.M));
                });

            if (data.LastEvaluatedKey)
                return get(data.LastEvaluatedKey);

            return cb(undefined, _.sortByAll(eventOccurrences, ['IsCancelled', 'Start']));
        });
    }
}

/*
Delete a single agenda item in the database.
Arguments:
- systemId = string : the ID of the system to delete the agenda item from
- agendaItem = object : plain JS object specifiying the agenda item to delete
                        REQUIRED PROPERTIES: AgendaId, OccurrenceId
- callback = function(err) : err is the error if one occurred
*/
function deleteAgendaItem(systemId, agendaItem, cb) {
    var agendaItemId = agendaItem.AgendaId + '#' + agendaItem.OccurrenceId;
    var params = {
        Key: {
            SystemId: {
                S: systemId
            },
            AgendaItemId: {
                S: agendaItemId
            }
        },
        Expected: {
            SystemId: {
                Exists: true,
                Value: {
                    S: systemId
                }
            },
            AgendaItemId: {
                Exists: true,
                Value: {
                    S: agendaItemId
                }
            }
        },
        TableName: tableName,
    };
    db.deleteItem(params, function(err, data) {
        if (err) {
            if (err.code === 'ConditionalCheckFailedException') {
                return cb('condition_violated');
            } else {
                console.log('ERROR (deleteAgendaItem)', err, err.stack);
                return cb(err);
            }
        } else {
            return cb(err);
        }
    });
}

/*
Gets a list of all agenda items in the database that reference a specific event occurrence.
This function does NOT expose pagination (though it will automatically retrieve extra pages internally)
Arguments:
- systemId = string : the system ID the query pertains to
- occurrenceId = string : the event occurrence ID to find agenda items by
- callback = function(err, agendaItems) : 
                err is the error if one occurred;
                agendaItems is a list of agenda items for this event occurrence with no sort order
*/
function getAgendaItemsByEventOccurrenceId(systemId, occurrenceId, cb) {
    var agendaItems = [];
    return get();

    function get(lastEvaluatedKey) {
        var params = {
            KeyConditions: {
                SystemId: {
                    ComparisonOperator: 'EQ',
                    AttributeValueList: [{
                        S: systemId
                    }]
                },
                OccurrenceId: {
                    ComparisonOperator: 'EQ',
                    AttributeValueList: [{
                        S: occurrenceId
                    }]
                }
            },
            ExclusiveStartKey: lastEvaluatedKey,
            TableName: tableName,
            IndexName: 'OccurrenceIdIndex',
            Select: 'ALL_PROJECTED_ATTRIBUTES'
        };
        db.query(params, function(err, data) {
            if (err) {
                console.log("ERROR (getAgendaItemsByEventOccurrenceId)", err, err.stack);
                return cb(err);
            }
            if (data && data.Items)
                data.Items.forEach(function(agendaItem) {
                    agendaItems.push(agendaItem);
                });

            if (data.LastEvaluatedKey)
                return get(data.LastEvaluatedKey);

            return cb(undefined, agendaItems);
        });
    }
}

/*
Updates occurrence data for all agenda items that match the supplied occurrenceId
Arguments:
- systemId = string : the system ID
- occurrenceId = string : the event occurrence ID to find agenda items by
- updateExpression = string: the DynamoDB UpdateExpression string
- expressionAttributeValues = object: the DynamoDB ExpressionAttributeValues object
- callback = function(err) : err is the error if one occurred
*/
function updateAgendaItemsByEventOccurrenceId(systemId, occurrenceId, updateExpression, expressionAttributeValues, cb) {
    expressionAttributeValues = _.assign({
        ':sys': {
            S: systemId
        }
    }, expressionAttributeValues);

    getAgendaItemsByEventOccurrenceId(systemId, occurrenceId, function(err, agendaItems) {
        var agendaItemIds = agendaItems.map(function(item) {
            return item.AgendaItemId.S;
        });

        async.eachSeries(agendaItemIds, updateAgendaItem, cb);
    });

    function updateAgendaItem(agendaItemId, cb) {
        var params = {
            Key: {
                SystemId: {
                    S: systemId
                },
                AgendaItemId: {
                    S: agendaItemId
                }
            },
            TableName: tableName,
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: _.assign({
                ':agItId': {
                    S: agendaItemId
                }
            }, expressionAttributeValues),
            ConditionExpression: 'SystemId=:sys AND AgendaItemId=:agItId'
        };
        db.updateItem(params, function(err, data) {
            return cb(err);
        });
    }
}

/*
Refreshes occurrence data for all agenda items with an updated occurrence object (raw)
Arguments:
- systemId = string : the system ID
- occurrenceAttributes = object : the attributes to update in DynamoDB form
                             (i.e. { Room: { S: ... }, Start: { N: ... }, .. })
- callback = function() : if an error occurred, it is simply logged, but not set in the callback
*/
function refreshOccurrenceDetails(systemId, occurrenceAttributes, cb) {
    var updateExpression = 'SET Occurrence = :occ',
        expressionAttributeValues = {
        ':occ': {
            M: occurrenceAttributes
        }
    };

    updateAgendaItemsByEventOccurrenceId(systemId, occurrenceAttributes.OccurrenceId.S, updateExpression, expressionAttributeValues, function(err) {
        if (err)
            console.log('ERROR (refreshOccurrenceDetails)', err, err.stack);
        return cb(); // do not report error, since it won't be handled
    });
}

/*
Sets the IsCancelled property to true for all the event occurrence objects within agenda items affected by the deletion of this occurrence
Arguments:
- systemId = string : the system ID
- occurrenceId = string : the event occurrence ID of the deleted occurrence
- callback = function() : if an error occurred, it is simply logged, but not set in the callback
*/
function markEventOccurrenceAsCancelled(systemId, occurrenceId, cb) {
    var updateExpression = 'SET Occurrence.IsCancelled = :cancel',
        expressionAttributeValues = {
        ':cancel': {
            BOOL: true
        }
    };

    updateAgendaItemsByEventOccurrenceId(systemId, occurrenceId, updateExpression, expressionAttributeValues, function(err) {
        if (err)
            console.log('ERROR (markEventOccurrenceAsCancelled)', err, err.stack);
        return cb(); // do not report error, since it won't be handled
    });
}

/*
Internally calls dbEvents.convertDatabaseItemToEventOccurrence(item),
but also checks for the IsCancelled property
Arguments:
- item: the database Item to convert
Returns:
- eventObj: the converted event occurrence object
*/
function convertDatabaseItemToEventOccurrence(item) {
    var eventObj = dbEvents.convertDatabaseItemToEventOccurrence(item);
    if (item.IsCancelled) eventObj.IsCancelled = item.IsCancelled.BOOL;
    return eventObj;
}

exports.createSchema = createSchema;
exports.deleteSchema = deleteSchema;
exports.putAgendaItem = putAgendaItem;
exports.getEventOccurrencesByAgendaId = getEventOccurrencesByAgendaId;
exports.deleteAgendaItem = deleteAgendaItem;
exports.updateAgendaItemsByEventOccurrenceId = updateAgendaItemsByEventOccurrenceId;
exports.refreshOccurrenceDetails = refreshOccurrenceDetails;
exports.markEventOccurrenceAsCancelled = markEventOccurrenceAsCancelled;
