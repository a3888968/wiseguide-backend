"use strict";

/*
Handles database interactions to do with Venues.
*/

var db = require('./dynamodb').db;
var dbEvents = require('./events');
var config = require('../utils/config');
var async = require('async');

var tableName = config.tablePrefix + "Venues";

/*
Creates the Venues table schema.
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
            AttributeName: 'VenueId',
            AttributeType: 'S'
        }, {
            AttributeName: 'Name',
            AttributeType: 'S'
        }, {
            AttributeName: 'Contributor',
            AttributeType: 'S'
        }],
        KeySchema: [{
            AttributeName: 'SystemId',
            KeyType: 'HASH'
        }, {
            AttributeName: 'VenueId',
            KeyType: 'RANGE'
        }],
        LocalSecondaryIndexes: [{
            IndexName: 'NameIndex',
            KeySchema: [{
                AttributeName: 'SystemId',
                KeyType: 'HASH'
            }, {
                AttributeName: 'Name',
                KeyType: 'RANGE'
            }],
            Projection: {
                ProjectionType: 'ALL'
            }
        }, {
            IndexName: 'ContributorIndex',
            KeySchema: [{
                AttributeName: 'SystemId',
                KeyType: 'HASH'
            }, {
                AttributeName: 'Contributor',
                KeyType: 'RANGE'
            }],
            Projection: {
                ProjectionType: 'ALL'
            }
        }],
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
                callback();
            } else {
                console.log("> Error", err, err.stack);
                callback(err);
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
                callback(err);
            } else if (data.Table.TableStatus === "ACTIVE") {
                console.log("> Table now active");
                callback();
            } else
                setTimeout(checkIfTableActive, 1000);
        });
    }
}

/*
Destroys the Venues table schema.
Arguments:
- callback = function(err) : err is an error if one occurred
*/
function deleteSchema(callback) {
    console.log("Deleting table " + tableName + "...");
    var params = {
        TableName: tableName
    };

    db.deleteTable(params, function(err, data) {
        if (err) callback(err);
        else checkIfTableNotExists();
    });

    function checkIfTableNotExists() {
        db.describeTable(params, function(err, data) {
            if (err) {
                if (err.code === 'ResourceNotFoundException') {
                    console.log('> Table deleted');
                    callback();
                } else {
                    console.log('> Error checking table', err, err.stack);
                    callback(err);
                }
            } else
                setTimeout(checkIfTableNotExists, 1000);
        });
    }
}

/*
Puts a new venue in the database.
Arguments:
- systemId = string : the system ID to create the venue for
- venue = object : an object containing the required venue properties
- callback = function(err) : err is the error if one occurred
*/
function putVenue(systemId, venue, callback) {
    var params = {
        Item: {
            SystemId: {
                S: systemId
            },
            VenueId: {
                S: venue.VenueId
            },
            Name: {
                S: venue.Name
            },
            Description: {
                S: venue.Description
            },
            Lat: {
                N: venue.Lat.toString()
            },
            Lon: {
                N: venue.Lon.toString()
            },
            Address: {
                S: venue.Address
            },
            Contributor: {
                S: venue.Contributor
            },
            Rooms: {
                SS: venue.Rooms
            }
        },
        TableName: tableName,
        Expected: {
            SystemId: {
                Exists: false
            },
            VenueId: {
                Exists: false
            }
        }
    };
    db.putItem(params, function(err, data) {
        if (err) {
            console.log("ERROR (putVenue)", err, err.stack);
            return callback(err, data);
        } else {
            return callback(err, data);
        }
    });
}

/*
Updates an existing venue in the database
Arguments:
- systemId = string : the system ID to modify a user for
- venueId = string : the ID of the venue to be updated
- newDetails = object : an object with just the properties to be updated specified
- contributorCondition = string : the username of the person making the edit. 
								  If it matches the contributor attribute on the venue, 
								  update succeeds, otherwise fails. Leave undefined
								  to skip the check.
- callback = function(err) : err is the error if one occurred
*/
function updateVenue(systemId, venueId, newDetails, contributorCondition, callback) {
    var params = {
        Key: {
            SystemId: {
                S: systemId
            },
            VenueId: {
                S: venueId
            }
        },
        TableName: tableName,
        AttributeUpdates: createAttributeUpdateObject(newDetails, true),
        Expected: {
            SystemId: {
                Exists: true,
                Value: {
                    S: systemId
                }
            },
            VenueId: {
                Exists: true,
                Value: {
                    S: venueId
                }
            }
        },
        ReturnValues: 'ALL_NEW'
    };
    if (contributorCondition) {
        params.Expected.Contributor = {
            ComparisonOperator: 'EQ',
            Value: {
                S: contributorCondition
            }
        };
    }

    db.updateItem(params, function(err, data) {
        if (err) {
            if (err.code === "ConditionalCheckFailedException") {
                return callback("condition_violated");
            } else {
                console.log("ERROR (updateVenue)", err, err.stack);
                return callback(err);
            }
        } else {
            return dbEvents.refreshVenueDetails(systemId, venueId, data.Attributes, callback);
        }
    });

    /*
	Converts a plain JS venue object to an object suitable for the DynamoDB UpdateItem call.
	Arguments:
	- details = object: plain JS venue object with just properties to be updated specified
	*/
    function createAttributeUpdateObject(details) {
        var attributeUpdates = {};
        var allowedProperties = ["Name", "Description", "Lat", "Lon", "Address"];
        var numberProperties = ["Lat", "Lon"];
        for (var property in details) {
            if (details.hasOwnProperty(property) &&
                allowedProperties.indexOf(property) !== -1 &&
                details[property]) {
                if (numberProperties.indexOf(property) !== -1)
                    attributeUpdates[property] = {
                        N: details[property].toString()
                    };
                else
                    attributeUpdates[property] = {
                        S: details[property]
                    };

                attributeUpdates[property] = {
                    Action: 'PUT',
                    Value: attributeUpdates[property]
                };
            }
        }
        return attributeUpdates;
    }
}

/*
Adds or deletes a room from an existing venue in the database
Arguments:
- systemId = string : the system ID to modify a user for
- venueId = string : the ID of the venue to be updated
- rooms = [list of strings] : the names of the new rooms or rooms to delete
- action = string : 'ADD' or 'DELETE'
- contributorCondition = string : the username of the person making the edit. 
								  If it matches the contributor attribute on the venue, 
								  update succeeds, otherwise fails. Leave undefined
								  to skip the check.
- callback = function(err) : err is the error if one occurred
*/
function addOrDeleteVenueRoom(systemId, venueId, rooms, action, contributorCondition, callback) {
    if (action !== "ADD" && action !== "DELETE")
        return callback("bad_action");

    if (action === "DELETE") {
        dbEvents.getEventOccurrencesByVenueId(systemId, venueId, function(err, occs) {
            async.each(occs, function(occ, cb) {
                if (rooms.indexOf(occ.Room) !== -1) return cb(true);
                else return cb();
            }, function(err) {
                if (err) return callback("room_has_events");
                else return doUpdate();
            });
        });
    } else
        doUpdate();

    function doUpdate() {
        var params = {
            Key: {
                SystemId: {
                    S: systemId
                },
                VenueId: {
                    S: venueId
                }
            },
            TableName: tableName,
            UpdateExpression: action + " Rooms :roomList",
            ConditionExpression: "attribute_exists(SystemId) AND attribute_exists(VenueId)",
            ExpressionAttributeValues: {
                ":roomList": {
                    "SS": rooms
                }
            },
            ReturnValues: 'ALL_NEW',
        };

        if (contributorCondition) {
            params.ConditionExpression += " AND Contributor = :contributor";
            params.ExpressionAttributeValues[":contributor"] = {
                "S": contributorCondition
            };
        }

        if (action === "DELETE")
            params.ConditionExpression += " AND NOT Rooms IN (:roomList)";

        db.updateItem(params, function(err, data) {
            if (err) {
                if (err.code === "ConditionalCheckFailedException")
                    return callback("condition_violated");
                else {
                    console.log("ERROR (addOrDeleteVenueRoom)", err, err.stack);
                    return callback(err);
                }
            } else
                return dbEvents.refreshVenueDetails(systemId, venueId, data.Attributes, callback);
        });
    }
}

/*
Delete a venue in the database.
Arguments:
- systemId = string : the ID of the system to delete the venue from
- venueId = string : the ID of the venue to delete
- contributorCondition = string : the username of the person making the edit. 
								  If it matches the contributor attribute on the venue, 
								  update succeeds, otherwise fails. Leave undefined
								  to skip the check.
- callback = function(err) : err is the error if one occurred
*/
function deleteVenue(systemId, venueId, contributorCondition, callback) {
    dbEvents.getEventOccurrencesByVenueId(systemId, venueId, function(err, occs) {
        if (err)
            return callback(err);
        else if (occs.length > 0)
            return callback("venue_has_events");
        else {
            var params = {
                Key: {
                    SystemId: {
                        S: systemId
                    },
                    VenueId: {
                        S: venueId
                    }
                },
                Expected: {
                    SystemId: {
                        Exists: true,
                        Value: {
                            S: systemId
                        }
                    },
                    VenueId: {
                        Exists: true,
                        Value: {
                            S: venueId
                        }
                    }
                },
                TableName: tableName,
            };
            if (contributorCondition) {
                params.Expected.Contributor = {
                    ComparisonOperator: 'EQ',
                    Value: {
                        S: contributorCondition
                    }
                };
            }
            db.deleteItem(params, function(err, data) {
                if (err) {
                    if (err.code === "ConditionalCheckFailedException") {
                        return callback("condition_violated");
                    } else {
                        console.log("ERROR (deleteVenue)", err, err.stack);
                        return callback(err);
                    }
                } else {
                    return callback(err);
                }
            });
        }
    });
}

/*
Get a venue's details by looking up its ID in the database.
Returns the object that came from the DynamoDB API: it is better to use
getVenueById if you need an object for use in a non-database context.
Arguments:
- systemId = string : the ID of the system to find the user in
- venueId = string : the ID of the venue whose details are being requested
- callback = function(err, venue) : err is the error if one occurred, venue
				is the raw database object containing the looked-up venue's details
*/
function getVenueByIdRaw(systemId, venueId, callback) {
    var params = {
        Key: {
            SystemId: {
                S: systemId
            },
            VenueId: {
                S: venueId
            }
        },
        TableName: tableName
    };
    db.getItem(params, function(err, data) {
        if (err) {
            console.log("ERROR (getVenueById)", err, err.stack);
            return callback(err);
        }

        return callback(err, data.Item);
    });
}

/*
Get a venue's details by looking up its ID in the database.
Arguments:
- systemId = string : the ID of the system to find the user in
- venueId = string : the ID of the venue whose details are being requested
- callback = function(err, venue) : err is the error if one occurred, venue
				is the object containing the looked-up venue's details
*/
function getVenueById(systemId, venueId, callback) {
    getVenueByIdRaw(systemId, venueId, function(err, venRaw) {
        if (err)
            return callback(err);
        else if (venRaw)
            return callback(undefined, convertDatabaseItemToVenue(venRaw));
        else
            return callback();
    });
}

/*
Gets a list of all venues in the database. This function does not expose
pagination (though it will automatically retrieve extra pages internally)
Arguments:
- systemId = string : the system ID the query pertains to
- callback = function(err, venues) : 
				err is the error if one occurred;
			 	venues is a list of venues for this system;
*/
function getAllVenues(systemId, callback) {
    var venues = [];
    return get();

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
            ScanIndexForward: true,
            ExclusiveStartKey: lastEvaluatedKey,
            TableName: tableName,
            IndexName: 'NameIndex',
            Select: 'ALL_PROJECTED_ATTRIBUTES'
        };
        db.query(params, function(err, data) {
            if (err) {
                console.log("ERROR (getAllVenues)", err, err.stack);
                return callback(err);
            }

            if (data && data.Count >= 1) {
                for (var i = 0; i < data.Count; i++) {
                    venues.push(convertDatabaseItemToVenue(data.Items[i]));
                }
            }

            if (data.LastEvaluatedKey)
                return get(data.LastEvaluatedKey);
            else
                return callback(undefined, venues);
        });
    }
}

/*
Converts a database Item to an venue object by extracting the relevant
properties.
Arguments:
- item: the database Item to convert
Returns:
- venue: the converted venue object
*/
function convertDatabaseItemToVenue(item) {
    var venue = {};
    if (item.VenueId) venue.VenueId = item.VenueId.S;
    if (item.Name) venue.Name = item.Name.S;
    if (item.Description) venue.Description = item.Description.S;
    if (item.Lat) venue.Lat = parseFloat(item.Lat.N);
    if (item.Lon) venue.Lon = parseFloat(item.Lon.N);
    if (item.Address) venue.Address = item.Address.S;
    if (item.Contributor) venue.Contributor = item.Contributor.S;
    if (item.Rooms) venue.Rooms = item.Rooms.SS;
    return venue;
}

exports.tableName = tableName;
exports.createSchema = createSchema;
exports.deleteSchema = deleteSchema;
exports.putVenue = putVenue;
exports.updateVenue = updateVenue;
exports.deleteVenue = deleteVenue;
exports.addOrDeleteVenueRoom = addOrDeleteVenueRoom;
exports.getAllVenues = getAllVenues;
exports.getVenueById = getVenueById;
exports.getVenueByIdRaw = getVenueByIdRaw;
exports.convertDatabaseItemToVenue = convertDatabaseItemToVenue;