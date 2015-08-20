"use strict";

/*
Handles database interactions to do with Systems.
*/

var db = require('./dynamodb').db;
var dbUsers = require('./users');
var config = require('../utils/config');

var tableName = config.tablePrefix + "Systems";

/*
Creates the Systems table schema.
Arguments:
- callback = function(err) : err is an error if one occurred
*/
function createSchema(callback) {
    console.log("Creating table " + tableName + "...");
    var params = {
        AttributeDefinitions: [{
            AttributeName: 'SystemId',
            AttributeType: 'S'
        }],
        KeySchema: [{
            AttributeName: 'SystemId',
            KeyType: 'HASH'
        }],
        ProvisionedThroughput: {
            ReadCapacityUnits: 3,
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
Destroys the Systems table schema.
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
Puts a new system in the database.
Arguments:
- systemId = string : the system ID to create
- systemProps = object : system properties (CenterLat, CenterLon)
- callback = function(err) : err is the error if one occurred
*/
function putSystem(systemId, systemProps, callback) {
    var params = {
        Item: convertSystemToDatabaseItem(systemProps),
        TableName: tableName,
        Expected: {
            SystemId: {
                Exists: false
            }
        }
    };
    db.putItem(params, function(err, data) {
        if (err) {
            if (err.code === "ConditionalCheckFailedException")
                return callback("systemid_exists");
            else {
                console.log(err, err.stack);
                return callback("ERROR (putSystem)", err, data);
            }
        } else {
            return callback(err, data);
        }
    });
}

/*
Updates a system in the database.
Arguments:
- systemId = string : the system ID to create
- newDetails = object : object with just the properties to change specified
						(only property is Lock at the moment)
- callback = function(err) : err is the error if one occurred
*/
function updateSystem(systemId, newDetails, callback) {
    if (!newDetails.hasOwnProperty('Lock'))
        return callback();
    var params = {
        Key: {
            SystemId: {
                S: systemId
            }
        },
        TableName: tableName,
        Expected: {
            SystemId: {
                Exists: true,
                Value: {
                    S: systemId
                }
            }
        },
        AttributeUpdates: {
            Lock: {
                Action: "PUT",
                Value: {
                    BOOL: newDetails.Lock
                }
            }
        },
        ReturnValues: 'ALL_NEW'
    };
    db.updateItem(params, function(err, data) {
        if (err) {
            if (err.code === "ConditionalCheckFailedException")
                return callback("systemid_not_found");
            else {
                console.log("ERROR (updateSystem)", err, err.stack);
                return callback(err, data);
            }
        } else {
            return dbUsers.refreshSystemDetails(systemId, data.Attributes, callback);
        }
    });
}

/*
Gets a system from the database.
Arguments:
- systemId = string : the system ID the query pertains to
- callback = function(err, sys) : err is the error if one occurred; sys is the system
*/
function getSystem(systemId, callback) {
    var params = {
        Key: {
            SystemId: {
                S: systemId
            }
        },
        TableName: tableName
    };
    db.getItem(params, function(err, data) {
        if (err) {
            console.log("ERROR (getSystem)", err, err.stack);
            return callback(err);
        }

        var system;
        if (data && data.Item) {
            system = convertDatabaseItemToSystem(data.Item);
        } else {
            system = null;
        }

        return callback(err, system);
    });
}

/*
Checks whether this system is currently in the queue for analysis
Arguments:
- systemId = string : the system ID the query pertains to
- callback = function(err, inQueue) : err is the error if one occurred;
                                      inQueue is a boolean OR null if no system found
*/
function checkIfInAnalysisQueue(systemId, callback) {
    var params = {
        Key: {
            SystemId: {
                S: systemId
            }
        },
        TableName: tableName
    };
    db.getItem(params, function(err, data) {
        if (err) {
            console.log("ERROR (getSystem)", err, err.stack);
            return callback(err);
        }

        var inQueue;
        if (data && data.Item) {
            if(data.Item.InQueue) inQueue = data.Item.InQueue.S === 'Y';
            else                  inQueue = false;
        } else {
            inQueue = null;
        }

        return callback(err, inQueue);
    });
}

/*
Sets a system's InQueue attribute to True to mark it as being in the analysis queue
Arguments:
- systemId = string : the system ID to set as in-queue
- callback = function(err) : err is the error if one occurred
*/
function setInAnalysisQueue(systemId, callback) {
    var params = {
        Key: {
            SystemId: {
                S: systemId
            }
        },
        TableName: tableName,
        Expected: {
            SystemId: {
                Exists: true,
                Value: {
                    S: systemId
                }
            }
        },
        AttributeUpdates: {
            InQueue: {
                Action: "PUT",
                Value: {
                    S: 'Y'
                }
            }
        }
    };
    db.updateItem(params, callback);
}

/*
Converts a database Item to a system object by extracting the relevant
properties.
Arguments:
- item: the database Item to convert
Returns:
- systemObj: the converted system object
*/
function convertDatabaseItemToSystem(item) {
    var system = {};
    if (item.hasOwnProperty('SystemId')) system.SystemId = item.SystemId.S;
    if (item.hasOwnProperty('Lock')) system.Lock = item.Lock.BOOL;
    if (item.hasOwnProperty('AppendToLocationQuery'))
        system.AppendToLocationQuery = item.AppendToLocationQuery.S;
    if (item.hasOwnProperty('CenterLat') && item.hasOwnProperty('CenterLon')) {
        system.Center = {
            Lat: parseFloat(item.CenterLat.N),
            Lon: parseFloat(item.CenterLon.N)
        };
    }
    return system;
}

/*
Converts a system object to a database Item by inserting the relevant
properties and data types
Arguments:
- system: the plain JS object containing the system properties
Returns:
- item: the converted database Item
*/
function convertSystemToDatabaseItem(system) {
    var item = {};
    if (system.hasOwnProperty('SystemId')) item.SystemId = {
        S: system.SystemId
    };
    if (system.hasOwnProperty('Lock')) item.Lock = {
        BOOL: system.Lock
    };
    if (system.hasOwnProperty('AppendToLocationQuery'))
        item.AppendToLocationQuery = {
            S: system.AppendToLocationQuery
        };
    if (system.hasOwnProperty('Center')) {
        item.CenterLat = {
            N: system.Center.Lat.toString()
        };
        item.CenterLon = {
            N: system.Center.Lon.toString()
        };
    }
    return item;
}


exports.createSchema = createSchema;
exports.deleteSchema = deleteSchema;
exports.putSystem = putSystem;
exports.updateSystem = updateSystem;
exports.getSystem = getSystem;
exports.checkIfInAnalysisQueue = checkIfInAnalysisQueue;
exports.setInAnalysisQueue = setInAnalysisQueue;
exports.convertDatabaseItemToSystem = convertDatabaseItemToSystem;
exports.convertSystemToDatabaseItem = convertSystemToDatabaseItem;