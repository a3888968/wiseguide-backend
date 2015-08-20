"use strict";

/*
Handles database interactions to do with Events.
*/

var _ = require('lodash');
var db = require('./dynamodb').db;
var dbVenues = require('./venues');
var dbCategories = require('./categories');
var dbAgendaItems = require('./agendaItems');
var config = require('../utils/config');
var async = require('async');
var _ = require('lodash');

var PAGELIMIT = 15;

var tableName = config.tablePrefix + "Events";

/*
Creates the Events table schema.
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
            AttributeName: 'OccurrenceId',
            AttributeType: 'S'
        }, {
            AttributeName: 'EventId',
            AttributeType: 'S'
        }, {
            AttributeName: 'VenueId',
            AttributeType: 'S'
        }, {
            AttributeName: 'Name',
            AttributeType: 'S'
        }, {
            AttributeName: 'Start',
            AttributeType: 'N'
        }, {
            AttributeName: 'Contributor',
            AttributeType: 'S'
        }],
        KeySchema: [{
            AttributeName: 'SystemId',
            KeyType: 'HASH'
        }, {
            AttributeName: 'OccurrenceId',
            KeyType: 'RANGE'
        }],
        LocalSecondaryIndexes: [{
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
        }, {
            IndexName: 'VenueIdIndex',
            KeySchema: [{
                AttributeName: 'SystemId',
                KeyType: 'HASH'
            }, {
                AttributeName: 'VenueId',
                KeyType: 'RANGE'
            }],
            Projection: {
                ProjectionType: 'ALL'
            }
        }, {
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
            IndexName: 'StartIndex',
            KeySchema: [{
                AttributeName: 'SystemId',
                KeyType: 'HASH'
            }, {
                AttributeName: 'Start',
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
            ReadCapacityUnits: 3,
            WriteCapacityUnits: 3
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
Destroys the Events table schema.
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
Adds a new event to the database.
Arguments:
- systemId = string : the system ID the query pertains to
- theEvent = object : with properties Name (string), Description (string), 
				   Categories (set of strings), Occurrences (object with
				   properties Start (number), End (number), VenueId (string),
				   Room (string), OccurrenceId (string)), EventId (string)
- callback = function(err) : err is the error if one occurred;
*/
function putEvent(systemId, theEvent, callback) {
    var occurrencesList = [];
    var venuesCache = [];

    /* check the categories are valid first */
    checkCategoriesValid(systemId, theEvent.Categories, function(err, catsValid) {
        if (!catsValid)
            return callback("bad_categories");
        else {
            /* For each occurrence, look up its venue and create an object for putting
			   in the database. Remember venues already looked up to avoid duplicate queries */
            async.eachSeries(theEvent.Occurrences, function(occurrence, cb) {
                for (var i = 0; i < venuesCache.length; i++) {
                    if (venuesCache[i].VenueId.S === occurrence.VenueId)
                        return addNewOccurrence(occurrence, venuesCache[i], cb);
                }
                dbVenues.getVenueByIdRaw(systemId, occurrence.VenueId, function(err, venue) {
                    if (err) {
                        console.log("ERROR (putEvent)", err, err.stack);
                        return cb(err);
                    } else if (!venue)
                        return cb("bad_venue");
                    else {
                        venuesCache.push(venue);
                        return addNewOccurrence(occurrence, venue, cb);
                    }
                });
            }, function(err) {
                if (err)
                    return callback(err);
                else {
                    /* Now put generated event occurrence rows in database */
                    tryPuttingItems(occurrencesList, 50, 0, function(err, data) {
                        if (err) {
                            console.log("ERROR (putEvent)", err, err.stack);
                            return callback(err);
                        } else
                            return callback();
                    });
                }
            });
        }
    });

    /* Given an occurrence row and a looked-up venue, creates an object for
	   putting in database */
    function addNewOccurrence(occurrence, venue, callback) {
        if (venue.Rooms.SS.indexOf(occurrence.Room) === -1)
            return callback("bad_room");
        else {
            var newItem = {
                PutRequest: {
                    Item: {
                        SystemId: {
                            S: systemId
                        },
                        Contributor: {
                            S: theEvent.Contributor
                        },
                        EventId: {
                            S: theEvent.EventId
                        },
                        Name: {
                            S: theEvent.Name
                        },
                        Description: {
                            S: theEvent.Description
                        },
                        OccurrenceId: {
                            S: occurrence.OccurrenceId
                        },
                        Start: {
                            N: occurrence.Start.toString()
                        },
                        End: {
                            N: occurrence.End.toString()
                        },
                        VenueId: {
                            S: occurrence.VenueId
                        },
                        Room: {
                            S: occurrence.Room
                        },
                        Venue: {
                            M: venue
                        }
                    }
                }
            };
            if (theEvent.hasOwnProperty('Categories') && theEvent.Categories.length > 0)
                newItem.PutRequest.Item.Categories = {
                    SS: theEvent.Categories
                };
            occurrencesList.push(newItem);
            return callback();
        }
    }

    /* Tries putting items, retrying any that are returned as 'unprocessed'
	   using an exponential back-off approach. */
    function tryPuttingItems(items, nextTimeout, attemptNo, callback) {
        var params = {
            RequestItems: {}
        };
        params.RequestItems[tableName] = items;
        db.batchWriteItem(params, function(err, data) {
            if (err) {
                return callback(err);
            } else if (data.UnprocessedItems &&
                data.UnprocessedItems[tableName] &&
                data.UnprocessedItems[tableName].length) {
                if (attemptNo > 3)
                    return callback("too_many_attempts");
                else
                    return setTimeout(tryPuttingItems,
                        nextTimeout,
                        data.UnprocessedItems[tableName],
                        nextTimeout * 2,
                        attemptNo + 1,
                        callback);
            } else {
                return callback(err, data);
            }
        });
    }
}

/*
Refreshes venue data for all event occurrences with a given venue ID
Arguments:
- systemId = string : the system ID
- venueId = string : the venue ID to refresh data for
- venueAttributes = object : the attributes to update in DynamoDB form
							 (i.e. { Name: { S: ... }, Lat: { N: ... }, .. })
- callback = function(err) : err is the error if one occurred
*/
function refreshVenueDetails(systemId, venueId, venueAttributes, callback) {
    var attributeUpdates = {
        Venue: {
            Action: 'PUT',
            Value: {
                M: venueAttributes
            }
        }
    };

    getEventOccurrencesByVenueId(systemId, venueId, function(err, eventOccurrences) {
        if (err) {
            console.log("ERROR (refreshVenueDetails)", err, err.stack);
            return callback(err);
        }
        async.eachSeries(eventOccurrences, updateOccurrence, function(err) {
            if (err)
                console.log("ERROR (refreshVenueDetails)", err, err.stack);
            return callback();
        });
    });

    function updateOccurrence(occurrence, cb) {
        var occurrenceId = occurrence.OccurrenceId;
        var params = {
            Key: {
                SystemId: {
                    S: systemId
                },
                OccurrenceId: {
                    S: occurrenceId
                }
            },
            TableName: tableName,
            AttributeUpdates: attributeUpdates,
            Expected: {
                SystemId: {
                    Exists: true,
                    Value: {
                        S: systemId
                    }
                },
                OccurrenceId: {
                    Exists: true,
                    Value: {
                        S: occurrenceId
                    }
                }
            },
            ReturnValues: 'ALL_NEW'
        };

        db.updateItem(params, function(err, data) {
            if (err) return cb(err);
            dbAgendaItems.refreshOccurrenceDetails(systemId, data.Attributes, cb);
        });
    }
}

/*
Removes or replaces a given category from any events it appears in
Arguments:
- systemId = string : the system ID
- categoryName = string : the category to remove
- newCategoryName = string : the category to replace it with (optional)
- callback = function(err) : err is the error if one occurred
*/
function replaceCategoryInEvents(systemId, categoryName, newCategoryName, callback) {
    doPage();

    function doPage(lastEvaluatedKey) {
        getEventOccurrencesByCategory(systemId, categoryName, lastEvaluatedKey, undefined, function(err, eventOccurrences, nextKey) {
            if (err) {
                console.log("ERROR (replaceCategoryInEvents)", err, err.stack);
                return callback(err);
            }
            async.eachSeries(eventOccurrences, updateOccurrence, function(err) {
                if (err) {
                    console.log("ERROR (replaceCategoryInEvents)", err, err.stack);
                    return callback(err);
                } else if (nextKey)
                    return doPage(nextKey);
                else
                    return callback();
            });
        });
    }

    function updateOccurrence(occurrence, cb) {
        var occurrenceId = occurrence.OccurrenceId;

        var params = {
            Key: {
                SystemId: {
                    S: systemId
                },
                OccurrenceId: {
                    S: occurrenceId
                }
            },
            TableName: tableName,
            UpdateExpression: "DELETE Categories :cat ",
            ConditionExpression: "SystemId=:sys AND OccurrenceId=:occ AND contains(Categories,:catCon)",
            ExpressionAttributeValues: {
                ":sys": {
                    S: systemId
                },
                ":occ": {
                    S: occurrenceId
                },
                ":cat": {
                    SS: [categoryName]
                },
                ":catCon": {
                    S: categoryName
                }
            },
            ReturnValues: 'ALL_NEW'
        };

        var shouldAddReplacement = true;
        if (occurrence.Event.Categories.length === 1) {
            shouldAddReplacement = false;
            params.UpdateExpression = "REMOVE Categories";
            delete params.ExpressionAttributeValues[":cat"];
        }

        db.updateItem(params, function(err, data) {
            if (newCategoryName) {
                params.UpdateExpression = "ADD Categories :cat";
                params.ExpressionAttributeValues[":cat"] = {
                    SS: [newCategoryName]
                };
                params.ConditionExpression = "SystemId=:sys AND OccurrenceId=:occ";
                delete params.ExpressionAttributeValues[":catCon"];
                db.updateItem(params, function(err, data) {
                    if (err) return cb(err);
                    dbAgendaItems.refreshOccurrenceDetails(systemId, data.Attributes, cb);
                });
            } else {
                if (err) return cb(err);
                dbAgendaItems.refreshOccurrenceDetails(systemId, data.Attributes, cb);
            }
        });
    }
}

/*
Makes updates for all event occurrences with a given event ID
Arguments:
- systemId = string : the system ID
- eventId = string : the event ID to edit data for
- eventAttributes = object : a plain JS object with just the properties to update defined
							 ALLOWED PROPERTIES: Name, Description, Categories
- contributorCondition = string : the username of the person making the edit. 
								  If it matches the contributor attribute on the event, 
								  update succeeds, otherwise fails. Leave undefined
								  to skip the check.
- callback = function(err) : err is the error if one occurred
*/
function updateEventOccurrencesByEventId(systemId, eventId, eventAttributes, contributorCondition, callback) {
    var attributeUpdates = createAttributeUpdateObject(eventAttributes);

    /* check the categories are valid first */
    if (eventAttributes.Categories) {
        checkCategoriesValid(systemId, eventAttributes.Categories, function(err, catsValid) {
            if (!catsValid)
                return callback("bad_categories");
            else
                return doUpdate();
        });
    } else
        return doUpdate();

    function doUpdate() {
        getEventOccurrencesByEventId(systemId, eventId, function(err, eventOccurrences) {
            if (err) {
                console.log("ERROR (updateEventOccurrencesByEventId)", err, err.stack);
                return callback(err);
            }
            async.eachSeries(eventOccurrences, updateOccurrence, function(err) {
                if (err) {
                    if (err.code === "ConditionalCheckFailedException") {
                        return callback("condition_violated");
                    }
                    console.log("ERROR (updateEventOccurrencesByEventId)", err, err.stack);
                }
                return callback(err);
            });
        });
    }

    function updateOccurrence(occurrence, cb) {
        var occurrenceId = occurrence.OccurrenceId;
        var params = {
            Key: {
                SystemId: {
                    S: systemId
                },
                OccurrenceId: {
                    S: occurrenceId
                }
            },
            TableName: tableName,
            AttributeUpdates: attributeUpdates,
            Expected: {
                SystemId: {
                    Exists: true,
                    Value: {
                        S: systemId
                    }
                },
                OccurrenceId: {
                    Exists: true,
                    Value: {
                        S: occurrenceId
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
            if (err) return cb(err);
            dbAgendaItems.refreshOccurrenceDetails(systemId, data.Attributes, cb);
        });
    }

    /*
	Converts a plain JS event object to an object suitable for the DynamoDB UpdateItem call.
	Arguments:
	- details = object: plain JS event object with just properties to be updated specified
	*/
    function createAttributeUpdateObject(details) {
        var attributeUpdates = {};
        var allowedProperties = ["Name", "Description", "Categories"];
        var stringSetProperties = ["Categories"];
        for (var property in details) {
            if (details.hasOwnProperty(property) &&
                allowedProperties.indexOf(property) !== -1 &&
                details[property]) {
                if (stringSetProperties.indexOf(property) !== -1)
                    attributeUpdates[property] = {
                        SS: details[property]
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
        if (attributeUpdates.hasOwnProperty('Categories') && details.Categories.length === 0)
            attributeUpdates.Categories = {
                Action: 'DELETE'
            };
        return attributeUpdates;
    }
}

/*
Adds a new occurrence of an existing event
Arguments:
- systemId = string : the system ID
- eventId = string : the event ID to edit data for
- occAttributes = object : a plain JS object with all occurrence properties defined
						   (Start, End, VenueId, Room)
- contributorCondition = string : the username of the person making the edit. 
								  If it matches the contributor attribute on the event, 
								  operation succeeds, otherwise fails. Leave undefined
								  to skip the check.
- callback = function(err) : err is the error if one occurred
*/
function putEventOccurrence(systemId, eventId, occAttributes, contributorCondition, callback) {
    getEventOccurrencesByEventId(systemId, eventId, function(err, eventOccurrences) {
        if (err) {
            console.log("ERROR (putEventOccurrence)", err, err.stack);
            return callback(err);
        } else if (!eventOccurrences || eventOccurrences.length === 0) {
            return callback("condition_violated");
        } else {
            var ev = eventOccurrences[0].Event;
            if (contributorCondition && contributorCondition !== occAttributes.Contributor) {
                return callback("condition_violated");
            }
            dbVenues.getVenueByIdRaw(systemId, occAttributes.VenueId, function(err, venue) {
                if (err) {
                    console.log("ERROR (putEventOccurrence)", err, err.stack);
                    return callback(err);
                } else if (!venue)
                    return callback("bad_venue");
                else
                    return addNewOccurrence(ev, occAttributes, venue);
            });
        }
    });

    /* Given an event, occurrence and a raw looked-up venue database object, 
	   puts occurrence in database */
    function addNewOccurrence(ev, occ, venue) {
        if (venue.Rooms.SS.indexOf(occ.Room) === -1)
            return callback("bad_room");
        else {
            var newItem = {
                SystemId: {
                    S: systemId
                },
                Contributor: {
                    S: ev.Contributor
                },
                EventId: {
                    S: ev.EventId
                },
                Name: {
                    S: ev.Name
                },
                Description: {
                    S: ev.Description
                },
                OccurrenceId: {
                    S: occ.OccurrenceId
                },
                Start: {
                    N: occ.Start.toString()
                },
                End: {
                    N: occ.End.toString()
                },
                VenueId: {
                    S: occ.VenueId
                },
                Room: {
                    S: occ.Room
                },
                Venue: {
                    M: venue
                }
            };
            if (ev.hasOwnProperty('Categories') && ev.Categories.length > 0)
                newItem.Categories = {
                    SS: ev.Categories
                };
            var params = {
                Item: newItem,
                TableName: tableName,
                Expected: {
                    SystemId: {
                        Exists: false
                    },
                    OccurrenceId: {
                        Exists: false
                    }
                }
            };
            db.putItem(params, function(err, data) {
                if (err)
                    console.log("ERROR (putEventOccurrence)", err, err.stack);
                return callback(err);
            });
        }
    }
}

/*
Updates an existing occurrence of an event
Arguments:
- systemId = string : the system ID
- eventId = string : the event ID to edit data for
- newDetails = object : a plain JS object with just the occurrence properties to update defined
						   (Start, End, VenueId, Room)
- contributorCondition = string : the username of the person making the edit. 
								  If it matches the contributor attribute on the event, 
								  operation succeeds, otherwise fails. Leave undefined
								  to skip the check.
- callback = function(err) : err is the error if one occurred
*/
function updateEventOccurrence(systemId, occurrenceId, newDetails, contributorCondition, callback) {
    if (newDetails.VenueId) {
        dbVenues.getVenueByIdRaw(systemId, newDetails.VenueId, function(err, venue) {
            if (err) {
                console.log("ERROR (updateEventOccurrence)", err, err.stack);
                return callback(err);
            } else if (!venue)
                return callback("bad_venue");
            else if (newDetails.Room && venue.Rooms.SS.indexOf(newDetails.Room) === -1)
                return callback("condition_violated");
            else {
                var details = JSON.parse(JSON.stringify(newDetails));
                details.Venue = venue;
                return doUpdate(details);
            }
        });
    } else
        return doUpdate(newDetails);

    function doUpdate(newDetails) {
        var details = createUpdateExpression(newDetails);
        details.values[":systemId"] = {
            S: systemId
        };
        details.values[":occurrenceId"] = {
            S: occurrenceId
        };
        var params = {
            Key: {
                SystemId: {
                    S: systemId
                },
                OccurrenceId: {
                    S: occurrenceId
                }
            },
            TableName: tableName,
            UpdateExpression: details.expression,
            ConditionExpression: "SystemId=:systemId AND OccurrenceId=:occurrenceId ",
            ExpressionAttributeNames: details.names,
            ExpressionAttributeValues: details.values,
            ReturnValues: 'ALL_NEW'
        };

        if (typeof newDetails.Start === "number" && typeof newDetails.End === "number") {
            if (newDetails.End < newDetails.Start)
                return callback("condition_violated");
        } else if (typeof newDetails.Start === "number" && typeof newDetails.End !== "number") {
            params.ConditionExpression += " AND #End>=:start ";
            params.ExpressionAttributeValues[":start"] = {
                N: newDetails.Start.toString()
            };
            params.ExpressionAttributeNames["#End"] = "End";
        } else if (typeof newDetails.End === "number" && typeof newDetails.Start !== "number") {
            params.ConditionExpression += " AND #Start<=:end ";
            params.ExpressionAttributeValues[":end"] = {
                N: newDetails.End.toString()
            };
            params.ExpressionAttributeNames["#Start"] = "Start";
        }

        if (newDetails.Room && !newDetails.Venue) {
            params.ConditionExpression += " AND contains(Venue.Rooms,:room) ";
            params.ExpressionAttributeValues[":room"] = {
                S: newDetails.Room
            };
        }

        if (contributorCondition) {
            params.ConditionExpression += " AND Contributor=:cont) ";
            params.ExpressionAttributeValues[":cont"] = {
                S: contributorCondition
            };
        }

        db.updateItem(params, function(err, data) {
            if (err) {
                if (err.code === "ConditionalCheckFailedException") {
                    return callback("condition_violated");
                } else {
                    console.log("ERROR (updateEventOccurrence)", err, err.stack);
                    return callback(err);
                }
            } else {
                dbAgendaItems.refreshOccurrenceDetails(systemId, data.Attributes, callback);
            }
        });
    }

    /*
	Converts a plain JS venue object to an expression suitable for the DynamoDB UpdateItem call.
	Arguments:
	- details = object: plain JS venue object with just properties to be updated specified
	*/
    function createUpdateExpression(details) {
        var exp = "SET ";
        var vals = {};
        var names = {};
        var allowedProperties = ["Start", "End", "VenueId", "Room", "Venue"];
        var numberProperties = ["Start", "End"];
        var mapProperties = ["Venue"];
        for (var property in details) {
            if (details.hasOwnProperty(property) &&
                allowedProperties.indexOf(property) !== -1 &&
                details[property]) {
                exp += " #" + property + "=:" + property + ",";
                names["#" + property] = property;
                if (numberProperties.indexOf(property) !== -1)
                    vals[":" + property] = {
                        N: details[property].toString()
                    };
                else if (mapProperties.indexOf(property) !== -1)
                    vals[":" + property] = {
                        M: details[property]
                    };
                else
                    vals[":" + property] = {
                        S: details[property]
                    };
            }
        }
        exp = exp.substring(0, exp.length - 1);
        return {
            "expression": exp,
            "values": vals,
            "names": names
        };
    }
}

/*
Delete a single event occurrence in the database.
Arguments:
- systemId = string : the ID of the system to delete the occurrence from
- occurrenceId = string : the ID of the occurrence to delete
- contributorCondition = string : the username of the person making the edit. 
								  If it matches the contributor attribute on the event, 
								  delete succeeds, otherwise fails. Leave undefined
								  to skip the check.
- callback = function(err) : err is the error if one occurred
*/
function deleteEventOccurrence(systemId, occurrenceId, contributorCondition, callback) {
    var params = {
        Key: {
            SystemId: {
                S: systemId
            },
            OccurrenceId: {
                S: occurrenceId
            }
        },
        Expected: {
            SystemId: {
                Exists: true,
                Value: {
                    S: systemId
                }
            },
            OccurrenceId: {
                Exists: true,
                Value: {
                    S: occurrenceId
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
                console.log("ERROR (deleteEventOccurrence)", err, err.stack);
                return callback(err);
            }
        } else {
            dbAgendaItems.markEventOccurrenceAsCancelled(systemId, occurrenceId, callback);
        }
    });
}

/*
Deletes all event occurrences with a given event ID
Arguments:
- systemId = string : the system ID
- eventId = string : the event ID to delete occurrences of
- contributorCondition = string : the username of the person making the deletion. 
								  If it matches the contributor attribute on the event, 
								  update succeeds, otherwise fails. Leave undefined
								  to skip the check.
- callback = function(err) : err is the error if one occurred
*/
function deleteEventOccurrencesByEventId(systemId, eventId, contributorCondition, callback) {
    getEventOccurrencesByEventId(systemId, eventId, function(err, eventOccurrences) {
        if (err) {
            console.log("ERROR (deleteEventOccurrencesByEventId)", err, err.stack);
            return callback(err);
        } else if (!eventOccurrences || eventOccurrences.length === 0) {
            return callback("condition_violated");
        } else if (contributorCondition && eventOccurrences[0].Event.Contributor !== contributorCondition) {
            return callback("condition_violated");
        } else {
            var tasks = [];
            async.each(eventOccurrences, function(occ, cb) {
                tasks.push({
                    DeleteRequest: {
                        Key: {
                            SystemId: {
                                S: systemId
                            },
                            OccurrenceId: {
                                S: occ.OccurrenceId
                            }
                        }
                    }
                });
                cb();
            }, function() {
                var requestItems = {};
                requestItems[tableName] = tasks;
                return doDelete(requestItems, function() {
                    async.eachSeries(eventOccurrences, function(occ, cb) {
                        dbAgendaItems.markEventOccurrenceAsCancelled(systemId, occ.OccurrenceId, cb);
                    }, callback);
                });
            });
        }
    });

    function doDelete(requestItems, cb) {
        var params = {
            RequestItems: requestItems
        };
        db.batchWriteItem(params, function(err, data) {
            if (err) {
                console.log("ERROR (deleteEventOccurrencesByEventId)", err, err.stack);
                return callback(err);
            } else if (data.UnprocessedItems && data.UnprocessedItems.length > 0)
                return doDelete(data.UnprocessedItems, cb);
            else
                return cb();
        });
    }
}

/*
Given a list of categories, checks they are all valid for the
given system.
- systemId = string : the system ID the check pertains to
- eventCategories = [array of strings] : the categories to check
- callback = function(err, valid) : err is the error if one occurred
									valid is a boolean (true if valid, false if not)
*/
function checkCategoriesValid(systemId, eventCategories, callback) {
    dbCategories.getAllCategories(systemId, function(err, categories) {
        if (err)
            return callback(err);
        else {
            async.each(eventCategories, function(category, cb) {
                if (categories.indexOf(category) === -1)
                    cb("bad_category");
                else
                    cb();
            }, function(err) {
                if (err === "bad_category") return callback(undefined, false);
                else if (err) return callback(err, undefined);
                else return callback(undefined, true);
            });
        }
    });
}

function getEventOccurrenceByIdRaw(systemId, occurrenceId, cb) {
    var params = {
        Key: {
            SystemId: {
                S: systemId
            },
            OccurrenceId: {
                S: occurrenceId
            }
        },
        TableName: tableName
    };
    db.getItem(params, function(err, data) {
        if (err) {
            console.log('ERROR (getEventOccurrenceById)', err, err.stack);
            return cb(err);
        }

        return cb(err, data.Item);
    });
}

function getEventOccurrenceById(systemId, occurrenceId, cb) {
    getEventOccurrenceByIdRaw(systemId, occurrenceId, function(err, occRaw) {
        if (err) return cb(err);
        else if (occRaw)
            return cb(undefined, convertDatabaseItemToEventOccurrence(occRaw));
        else
            return cb();
    });
}

/*
Gets a list of all event occurrences in the database. This function uses pagination.
Arguments:
- systemId = string : the system ID the query pertains to
- lastEvaluatedKey = object : the lastEvaluatedKey from the previous page
- sortFilterParams = undefined, or an object of the form
					{ Sort: "Start" } OR
					{ Sort: "Start", Start: start unix ts string } OR
					{ Sort: "Start", Start: start unix ts string, End: end unix ts string } OR
					{ Sort: "Name" }
					: to specify sort order and filtering on start and end times.
- callback = function(err, eventOccurrences, lastEvaluatedKey) : 
				err is the error if one occurred;
			 	eventOccurrences is a list of occurences of events for this system 
			 					 sorted in ascending order of start time
			 	lastEvaluatedKey is the key to supply to get the next page;
*/
function getAllEventOccurrences(systemId, lastEvaluatedKey, sortFilterParams, callback) {
    if (sortFilterParams && sortFilterParams.Sort !== "Start" && sortFilterParams.Sort !== "Name")
        return callback("sort_order_unsupported");

    var eventOccurrences = [];
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
        Limit: PAGELIMIT,
        IndexName: 'StartIndex',
        Select: 'ALL_PROJECTED_ATTRIBUTES'
    };
    applySortAndFilterParams(params, sortFilterParams);
    db.query(params, function(err, data) {
        if (err) {
            console.log("ERROR (getAllEventOccurrences)", err, err.stack);
            return callback(err);
        }

        if (data && data.Count >= 1) {
            for (var i = 0; i < data.Count; i++) {
                eventOccurrences.push(convertDatabaseItemToEventOccurrence(data.Items[i]));
            }
        }

        return callback(err, eventOccurrences, data.LastEvaluatedKey);
    });
}

/*
Gets an array of events by their event ID
This function does not expose any pagination.
Arguments:
- systemId = string : the system ID the query pertains to
- eventIds = Array[string] : the event IDs the query pertains to
- callback = function(err, eventOccurrences) : 
                err is the error if one occurred;
                eventOccurrences is a list of event occurrences with no guaranteed sort order
*/
function getEventsByEventIds(systemId, eventIds, callback) {
    var results = [];
    async.eachSeries(eventIds, get, function(err) {
        return callback(err, results);
    });

    function get(eventId, cb) {
        var params = {
            KeyConditions: {
                SystemId: {
                    ComparisonOperator: 'EQ',
                    AttributeValueList: [{
                        S: systemId
                    }]
                },
                EventId: {
                    ComparisonOperator: 'EQ',
                    AttributeValueList: [{
                        S: eventId
                    }]
                }
            },
            TableName: tableName,
            IndexName: 'EventIdIndex',
            Select: 'ALL_PROJECTED_ATTRIBUTES'
        };
        db.query(params, function(err, data) {
            if (err) {
                console.log("ERROR (getEventsByEventIds)", err, err.stack);
                return callback(err);
            }

            var result;
            if (data && data.Count >= 1) {
                results.push(convertDatabaseItemToEventOccurrence(data.Items[0]).Event);
            }

            return cb(undefined);
        });
    }
}

/*
Gets a list of all occurrences in the database of a particular event.
This function does not expose pagination but handles it internally.
Arguments:
- systemId = string : the system ID the query pertains to
- eventId = string : the event ID the query pertains to
- callback = function(err, eventOccurrences) : 
                err is the error if one occurred;
                eventOccurrences is a list of events for this venue with no sort order
*/
function getEventOccurrencesByEventId(systemId, eventId, callback) {
    var eventOccurrences = [];
    get();

    function get(lastEvaluatedKey) {
        var params = {
            KeyConditions: {
                SystemId: {
                    ComparisonOperator: 'EQ',
                    AttributeValueList: [{
                        S: systemId
                    }]
                },
                EventId: {
                    ComparisonOperator: 'EQ',
                    AttributeValueList: [{
                        S: eventId
                    }]
                }
            },
            ExclusiveStartKey: lastEvaluatedKey,
            TableName: tableName,
            IndexName: 'EventIdIndex',
            Select: 'ALL_PROJECTED_ATTRIBUTES'
        };
        db.query(params, function(err, data) {
            if (err) {
                console.log("ERROR (getEventOccurrencesByEventId)", err, err.stack);
                return callback(err);
            }

            if (data && data.Count >= 1) {
                for (var i = 0; i < data.Count; i++) {
                    eventOccurrences.push(convertDatabaseItemToEventOccurrence(data.Items[i]));
                }
            }

            if (data.LastEvaluatedKey)
                return get(data.LastEvaluatedKey);
            else
                return callback(undefined, eventOccurrences);
        });
    }
}

/*
Gets a list of all event occurrences in the database for a particular venue.
This function does not expose pagination but handles it internally.
Arguments:
- systemId = string : the system ID the query pertains to
- venueId = string : the venue ID the query pertains to
- callback = function(err, eventOccurrences) : 
				err is the error if one occurred;
			 	eventOccurrences is a list of events for this venue with no sort order
*/
function getEventOccurrencesByVenueId(systemId, venueId, callback) {
    var eventOccurrences = [];
    get();

    function get(lastEvaluatedKey) {
        var params = {
            KeyConditions: {
                SystemId: {
                    ComparisonOperator: 'EQ',
                    AttributeValueList: [{
                        S: systemId
                    }]
                },
                VenueId: {
                    ComparisonOperator: 'EQ',
                    AttributeValueList: [{
                        S: venueId
                    }]
                }
            },
            ExclusiveStartKey: lastEvaluatedKey,
            TableName: tableName,
            IndexName: 'VenueIdIndex',
            Select: 'ALL_PROJECTED_ATTRIBUTES'
        };
        db.query(params, function(err, data) {
            if (err) {
                console.log("ERROR (getEventOccurrencesByVenueId)", err, err.stack);
                return callback(err);
            }

            if (data && data.Count >= 1) {
                for (var i = 0; i < data.Count; i++) {
                    eventOccurrences.push(convertDatabaseItemToEventOccurrence(data.Items[i]));
                }
            }

            if (data.LastEvaluatedKey)
                return get(data.LastEvaluatedKey);
            else
                return callback(undefined, eventOccurrences);
        });
    }
}

/*
Gets a list of all event occurrences in the database for a particular venue and filter expression.
This function does not expose pagination but handles it internally.
Arguments:
- systemId = string : the system ID the query pertains to
- venueId = string : the venue ID the query pertains to
- projectionExpression = string [optional]: a DynamoDB ProjectionExpression string to narrow down results
- filter = object : object containing FilterExpression, ExpressionAttributeNames, ExpressionAttributeValues
- callback = function(err, eventOccurrences) : 
                err is the error if one occurred;
                eventOccurrences is a list of events for this venue with no sort order
*/
function getFilteredEventOccurrencesByVenueId(systemId, venueId, projectionExpression, filter, callback) {
    var eventOccurrences = [];
    get();

    function get(lastEvaluatedKey) {
        var params = {
            KeyConditions: {
                SystemId: {
                    ComparisonOperator: 'EQ',
                    AttributeValueList: [{
                        S: systemId
                    }]
                },
                VenueId: {
                    ComparisonOperator: 'EQ',
                    AttributeValueList: [{
                        S: venueId
                    }]
                }
            },
            ExclusiveStartKey: lastEvaluatedKey,
            TableName: tableName,
            IndexName: 'VenueIdIndex',
        };

        _.assign(params, filter);
        params.ProjectionExpression = typeof projectionExpression === 'string' && (projectionExpression = projectionExpression.trim()) ? projectionExpression : undefined;

        db.query(params, function(err, data) {
            if (err) {
                console.log('ERROR (getFilteredEventOccurrencesByVenueId)', err, err.stack);
                return callback(err);
            }

            if (data && data.Items)
                data.Items.forEach(function(eventItem) {
                    eventOccurrences.push(convertDatabaseItemToEventOccurrence(eventItem));
                });

            if (data.LastEvaluatedKey)
                return get(data.LastEvaluatedKey);
            else
                return callback(undefined, eventOccurrences);
        });
    }
}

/*
Gets a list of all event occurrences in the database, filtered by whether they
contain a provided substring in their name.
This function exposes pagination.
Arguments:
- systemId = string : the system ID the query pertains to
- nameQuery = string : the string to filter the event names by
- lastEvaluatedKey = object : the lastEvaluatedKey from the previous page
- sortFilterParams = undefined, or an object of the form
					{ Sort: "Start" } OR
					{ Sort: "Start", Start: start unix ts string } OR
					{ Sort: "Start", Start: start unix ts string, End: end unix ts string }
					: to specify sort order and filtering on start and end times. Note that
					  sorting by name is NOT permitted for this function.
- callback = function(err, eventOccurrences) : 
				err is the error if one occurred;
			 	eventOccurrences is a list of events for this query sorted by start time
*/
function getEventOccurrencesByName(systemId, name, lastEvaluatedKey, sortFilterParams, callback) {
    if (sortFilterParams && sortFilterParams.Sort !== "Start")
        return callback("sort_order_unsupported");

    var eventOccurrences = [];
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
        IndexName: 'StartIndex',
        Limit: PAGELIMIT,
        Select: 'ALL_PROJECTED_ATTRIBUTES',
        FilterExpression: 'contains (#Name,:query)',
        ExpressionAttributeNames: {
            "#Name": "Name"
        },
        ExpressionAttributeValues: {
            ":query": {
                "S": name
            }
        }
    };
    applySortAndFilterParams(params, sortFilterParams);
    db.query(params, function(err, data) {
        if (err) {
            console.log("ERROR (getEventOccurrencesByName)", err, err.stack);
            return callback(err);
        }
        if (data && data.Count >= 1) {
            for (var i = 0; i < data.Count; i++) {
                eventOccurrences.push(convertDatabaseItemToEventOccurrence(data.Items[i]));
            }
        }
        return callback(undefined, eventOccurrences, data.LastEvaluatedKey);
    });
}

/*
Gets a list of all event occurrences in the database, filtered by category.
This function exposes pagination.
Arguments:
- systemId = string : the system ID the query pertains to
- category = string : the category to filter by
- lastEvaluatedKey = object : the lastEvaluatedKey from the previous page
- sortFilterParams = undefined, or an object of the form
					{ Sort: "Start" } OR
					{ Sort: "Start", Start: start unix ts string } OR
					{ Sort: "Start", Start: start unix ts string, End: end unix ts string } OR
					{ Sort: "Name" }
					: to specify sort order and filtering on start and end times.
- callback = function(err, eventOccurrences, lastEvaluatedKey) : 
				err is the error if one occurred;
			 	eventOccurrences is a list of events for this category sorted by start time
			 	lastEvaluatedKey is the key to be supplied to get the next page of results
*/
function getEventOccurrencesByCategory(systemId, category, lastEvaluatedKey, sortFilterParams, callback) {
    if (sortFilterParams && sortFilterParams.Sort !== "Start" && sortFilterParams.Sort !== "Name")
        return callback("sort_order_unsupported");

    var eventOccurrences = [];
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
        IndexName: 'StartIndex',
        Limit: PAGELIMIT,
        Select: 'ALL_PROJECTED_ATTRIBUTES',
        FilterExpression: 'contains (#Categories,:category)',
        ExpressionAttributeNames: {
            "#Categories": "Categories"
        },
        ExpressionAttributeValues: {
            ":category": {
                "S": category
            }
        }
    };
    applySortAndFilterParams(params, sortFilterParams);
    db.query(params, function(err, data) {
        if (err) {
            console.log("ERROR (getEventOccurrencesByCategory)", err, err.stack);
            return callback(err);
        }
        if (data && data.Count >= 1) {
            for (var i = 0; i < data.Count; i++) {
                eventOccurrences.push(convertDatabaseItemToEventOccurrence(data.Items[i]));
            }
        }
        return callback(undefined, eventOccurrences, data.LastEvaluatedKey);
    });
}

/*
Gets a list of all event occurrences in the database
This function does NOT expose pagination.
Arguments:
- systemId = string : the system ID the query pertains to
- time = string : a string representation of a integer that is the UNIX timestamp to query for
- callback = function(err, eventOccurrences) : 
                err is the error if one occurred;
                eventOccurrences is a list of event occurrences sorted by start time
*/
function getEventOccurrencesOngoingAtTime(systemId, time, callback) {
    var eventOccurrences = [];
    get();

    function get(lastEvaluatedKey) {
        var params = {
            KeyConditions: {
                SystemId: {
                    ComparisonOperator: 'EQ',
                    AttributeValueList: [{
                        S: systemId
                    }]
                },
                Start: {
                    ComparisonOperator: 'LE',
                    AttributeValueList: [{
                        N: time
                    }]
                }
            },
            ScanIndexForward: true,
            ExclusiveStartKey: lastEvaluatedKey,
            TableName: tableName,
            IndexName: 'StartIndex',
            Select: 'ALL_PROJECTED_ATTRIBUTES',
            FilterExpression: '#End >= :time',
            ExpressionAttributeNames: {
                "#End": "End"
            },
            ExpressionAttributeValues: {
                ":time": {
                    "N": time
                }
            }
        };
        db.query(params, function(err, data) {
            if (err) {
                console.log("ERROR (getEventOccurrencesOngoingAtTime)", err, err.stack);
                return callback(err);
            }
            if (data && data.Count >= 1) {
                for (var i = 0; i < data.Count; i++) {
                    eventOccurrences.push(convertDatabaseItemToEventOccurrence(data.Items[i]));
                }
            }
            if (data.LastEvaluatedKey)
                return get(data.LastEvaluatedKey);
            else
                return callback(undefined, eventOccurrences);
        });
    }
}

/*
Gets a list of all event occurrences in the database that are by a specific user.
This function does NOT expose pagination.
Arguments:
- systemId = string : the system ID the query pertains to
- owner = string : the username to find events by
- callback = function(err, eventOccurrences) : 
                err is the error if one occurred;
                eventOccurrences is a list of event occurrences with no guaranteed sort order
*/
function getEventOccurrencesByContributor(systemId, contributor, callback) {
    var eventOccurrences = [];
    get();

    function get(lastEvaluatedKey) {
        var params = {
            KeyConditions: {
                SystemId: {
                    ComparisonOperator: 'EQ',
                    AttributeValueList: [{
                        S: systemId
                    }]
                },
                Contributor: {
                    ComparisonOperator: 'EQ',
                    AttributeValueList: [{
                        S: contributor
                    }]
                }
            },
            ExclusiveStartKey: lastEvaluatedKey,
            TableName: tableName,
            IndexName: 'ContributorIndex',
            Select: 'ALL_PROJECTED_ATTRIBUTES'
        };
        db.query(params, function(err, data) {
            if (err) {
                console.log("ERROR (getEventOccurrencesByContributor)", err, err.stack);
                return callback(err);
            }
            if (data && data.Count >= 1) {
                for (var i = 0; i < data.Count; i++) {
                    eventOccurrences.push(convertDatabaseItemToEventOccurrence(data.Items[i]));
                }
            }
            if (data.LastEvaluatedKey)
                return get(data.LastEvaluatedKey);
            else
                return callback(undefined, eventOccurrences);
        });
    }
}


/*
Applies sort and filter parameters to a DynamoDB query params object
Arguments:
- dbParams: the existing DynamoDB query params object to apply the sort/filter to
- sortFilterParams: the sort and filter params to apply
*/
function applySortAndFilterParams(dbParams, sortFilterParams) {
    if (!sortFilterParams)
        return;
    else if (sortFilterParams.Sort === "Name") {
        dbParams.IndexName = "NameIndex";
        dbParams.ScanIndexForward = true;
    } else if (sortFilterParams.Sort === "Start") {
        dbParams.IndexName = "StartIndex";
        dbParams.ScanIndexForward = true;
        if (sortFilterParams.Start) {
            dbParams.KeyConditions.Start = {
                ComparisonOperator: 'GE',
                AttributeValueList: [{
                    N: sortFilterParams.Start
                }]
            };
            if (sortFilterParams.End) {
                if (dbParams.FilterExpression)
                    dbParams.FilterExpression += " AND #End <= :end";
                else
                    dbParams.FilterExpression = "#End <= :end";
                if (dbParams.ExpressionAttributeValues)
                    dbParams.ExpressionAttributeValues[":end"] = {
                        N: sortFilterParams.End
                    };
                else
                    dbParams.ExpressionAttributeValues = {
                        ":end": {
                            N: sortFilterParams.End
                        }
                    };
                if (dbParams.ExpressionAttributeNames)
                    dbParams.ExpressionAttributeNames["#End"] = "End";
                else
                    dbParams.ExpressionAttributeNames = {
                        "#End": "End"
                    };
            }
        }
    }
}

/*
Converts a database Item to an event occurrence object by extracting the relevant
properties.
Arguments:
- item: the database Item to convert
Returns:
- eventObj: the converted event occurrence object
*/
function convertDatabaseItemToEventOccurrence(item) {
    var eventObj = {};

    if (item.OccurrenceId) eventObj.OccurrenceId = item.OccurrenceId.S;
    if (item.Start) eventObj.Start = parseInt(item.Start.N);
    if (item.End) eventObj.End = parseInt(item.End.N);
    if (item.Room) eventObj.Room = item.Room.S;
    if (item.Venue) eventObj.Venue = dbVenues.convertDatabaseItemToVenue(item.Venue.M);

    eventObj.Event = {};
    if (item.EventId) eventObj.Event.EventId = item.EventId.S;
    if (item.Name) eventObj.Event.Name = item.Name.S;
    if (item.Categories) eventObj.Event.Categories = item.Categories.SS;
    if (item.Description) eventObj.Event.Description = item.Description.S;
    if (item.Contributor) eventObj.Event.Contributor = item.Contributor.S;

    return eventObj;
}

exports.tableName = tableName;
exports.createSchema = createSchema;
exports.deleteSchema = deleteSchema;
exports.putEvent = putEvent;
exports.refreshVenueDetails = refreshVenueDetails;
exports.replaceCategoryInEvents = replaceCategoryInEvents;
exports.putEventOccurrence = putEventOccurrence;
exports.updateEventOccurrence = updateEventOccurrence;
exports.deleteEventOccurrence = deleteEventOccurrence;
exports.getEventOccurrenceById = getEventOccurrenceById;
exports.getEventOccurrenceByIdRaw = getEventOccurrenceByIdRaw;
exports.updateEventOccurrencesByEventId = updateEventOccurrencesByEventId;
exports.deleteEventOccurrencesByEventId = deleteEventOccurrencesByEventId;
exports.getAllEventOccurrences = getAllEventOccurrences;
exports.getEventOccurrencesByContributor = getEventOccurrencesByContributor;
exports.getEventOccurrencesByVenueId = getEventOccurrencesByVenueId;
exports.getFilteredEventOccurrencesByVenueId = getFilteredEventOccurrencesByVenueId;
exports.getEventOccurrencesByEventId = getEventOccurrencesByEventId;
exports.getEventsByEventIds = getEventsByEventIds;
exports.getEventOccurrencesByName = getEventOccurrencesByName;
exports.getEventOccurrencesByCategory = getEventOccurrencesByCategory;
exports.getEventOccurrencesOngoingAtTime = getEventOccurrencesOngoingAtTime;
exports.convertDatabaseItemToEventOccurrence = convertDatabaseItemToEventOccurrence;