'use strict';

/*
Handles database interactions to do with Agendas.
*/

var db = require('./dynamodb').db;
var dbAgendaItems = require('./agendaItems');
var config = require('../utils/config');

var tableName = config.tablePrefix + "Agendas";

/*
Creates the Agendas table schema.
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
            AttributeName: 'AgendaId',
            AttributeType: 'S'
        }],
        KeySchema: [{
            AttributeName: 'SystemId',
            KeyType: 'HASH'
        }, {
            AttributeName: 'AgendaId',
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
Puts a new agenda in the database.
Arguments:
- systemId = string : the system ID to create the agenda for
- agendaId = string : the agenda ID
- callback = function(err) : err is the error if one occurred
*/
function putAgenda(systemId, agendaId, callback) {
    var params = {
        Item: {
            SystemId: {
                S: systemId
            },
            AgendaId: {
                S: agendaId
            }
        },
        TableName: tableName,
        Expected: {
            SystemId: {
                Exists: false
            },
            AgendaId: {
                Exists: false
            }
        }
    };
    db.putItem(params, function(err, data) {
        if (err) {
            console.log("ERROR (putAgenda)", err, err.stack);
            return callback(err, data);
        } else {
            return callback(err, data);
        }
    });
}

/*
Checks whether the requested agenda ID exists in the database.
Arguments:
- systemId = string : the system ID to check the agenda ID for
- agendaId = string : the agenda ID to check
- callback = function(err, agendaExists) :
                err is the error if one occurred;
                agendaExists is a boolean
*/
function checkAgendaExists(systemId, agendaId, cb) {
    var params = {
        Key: {
            SystemId: {
                S: systemId
            },
            AgendaId: {
                S: agendaId
            }
        },
        TableName: tableName
    };
    db.getItem(params, function(err, data) {
        if (err) {
            console.log('ERROR (checkAgendaExists)', err, err.stack);
            return cb(err);
        }

        return cb(err, !!data.Item);
    });
}

/*
Get an agenda's details by looking up its ID in the database.
Arguments:
- systemId = string : the ID of the system to find the user in
- agendaId = string : the ID of the agenda whose details are being requested
- callback = function(err, agenda) : err is the error if one occurred, agenda
                is the object containing the looked-up agenda's details
                where the only key EventOccurrences is an array of event occurrences
*/
function getAgendaById(systemId, agendaId, cb) {
    checkAgendaExists(systemId, agendaId, function(err, agendaExists) {
        if (!agendaExists)
            return cb('agenda_not_found');

        dbAgendaItems.getEventOccurrencesByAgendaId(systemId, agendaId, function(err, occs) {
            if (err) return cb(err);

            return cb(err, {
                EventOccurrences: occs
            });
        });
    });
}

exports.createSchema = createSchema;
exports.deleteSchema = deleteSchema;
exports.putAgenda = putAgenda;
exports.checkAgendaExists = checkAgendaExists;
exports.getAgendaById = getAgendaById;
