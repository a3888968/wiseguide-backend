"use strict";

/*
Handles database interactions to do with Categories.
*/

var db = require('./dynamodb').db;
var dbEvents = require('./events');
var config = require('../utils/config');

var tableName = config.tablePrefix + "Categories";

/*
Creates the Categories table schema.
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
            AttributeName: 'Name',
            AttributeType: 'S'
        }],
        KeySchema: [{
            AttributeName: 'SystemId',
            KeyType: 'HASH'
        }, {
            AttributeName: 'Name',
            KeyType: 'RANGE'
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
Destroys the Categories table schema.
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
Looks up a category name in the database to check if it exists.
Arguments:
- systemId = string : the system ID the query pertains to
- categoryname = string : the name of the category to be looked up
- callback = function(err, exists) : err is the error if one occurred;
			 exists is a boolean indicating if the category exists
*/
function checkIfCategoryExists(systemId, categoryName, callback) {
    var params = {
        Key: {
            SystemId: {
                S: systemId
            },
            Name: {
                S: categoryName
            }
        },
        TableName: tableName
    };
    db.getItem(params, function(err, data) {
        if (err) {
            console.log("ERROR (checkIfCategoryExists)", err, err.stack);
            return callback(err);
        }

        if (data.Item)
            return callback(err, true);
        else
            return callback(err, false);
    });
}

/*
Gets a list of all categories in the database. No pagination occurs with
this function - it will recurse until all categories have been retrieved.
Arguments:
- systemId = string : the system ID the query pertains to
- callback = function(err, cats) : err is the error if one occurred; cats
			 is a list of category names for this system
*/
function getAllCategories(systemId, callback) {
    var cats = [];
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
            ScanIndexForward: true,
            ExclusiveStartKey: lastEvaluatedKey,
            TableName: tableName,
            Select: 'ALL_ATTRIBUTES'
        };
        db.query(params, function(err, data) {
            if (err) {
                console.log("ERROR (getAllCategories)", err, err.stack);
                return callback(err);
            }

            if (data && data.Count >= 1) {
                for (var i = 0; i < data.Count; i++) {
                    cats.push(data.Items[i].Name.S);
                }
            }

            if (data.LastEvaluatedKey)
                get(data.LastEvaluatedKey);
            else
                return callback(null, cats);
        });
    }
}

/*
Puts a new category in the database.
Arguments:
- systemId = string : the system ID the query pertains to
- categoryName = string : the name of the new category
- callback = function(err) : err is the error if one occurred
*/
function putCategory(systemId, categoryName, callback) {
    var params = {
        Item: {
            SystemId: {
                S: systemId
            },
            Name: {
                S: categoryName
            }
        },
        TableName: tableName,
        Expected: {
            SystemId: {
                Exists: false
            },
            Name: {
                Exists: false
            }
        }
    };
    db.putItem(params, function(err, data) {
        if (err) {
            if (err.code === "ConditionalCheckFailedException")
                return callback("category_exists");
            else {
                console.log("ERROR (putCategory)", err, err.stack);
                return callback(err, data);
            }
        } else {
            return callback(err, data);
        }
    });
}

/*
Removes a category from the database.
Arguments:
- systemId = string : the system ID the query pertains to
- categoryName = string : the name of the category to delete
- callback = function(err) : err is the error if one occurred
*/
function deleteCategory(systemId, categoryName, callback) {
    var params = {
        Key: {
            SystemId: {
                S: systemId
            },
            Name: {
                S: categoryName
            }
        },
        TableName: tableName,
        Expected: {
            SystemId: {
                Exists: true,
                Value: {
                    S: systemId
                }
            },
            Name: {
                Exists: true,
                Value: {
                    S: categoryName
                }
            }
        }
    };
    db.deleteItem(params, function(err, data) {
        if (err) {
            if (err.code === "ConditionalCheckFailedException")
                return callback("category_not_found");
            else {
                console.log("ERROR (deleteCategory)", err, err.stack);
                return callback(err, data);
            }
        } else {
            return dbEvents.replaceCategoryInEvents(systemId, categoryName, undefined, callback);
        }
    });
}

/*
Edits a category name in the database.
Arguments:
- systemId = string : the system ID the query pertains to
- categoryName = string : the name of the category to edit
- newCategoryName = string : the new name to give to the category
- callback = function(err) : err is the error if one occurred
*/
function updateCategory(systemId, categoryName, newCategoryName, callback) {
    var params = {
        Key: {
            SystemId: {
                S: systemId
            },
            Name: {
                S: categoryName
            }
        },
        TableName: tableName,
        Expected: {
            SystemId: {
                Exists: true,
                Value: {
                    S: systemId
                }
            },
            Name: {
                Exists: true,
                Value: {
                    S: categoryName
                }
            }
        }
    };
    db.deleteItem(params, function(err, data) {
        if (err) {
            if (err.code === "ConditionalCheckFailedException")
                return callback("category_not_found");
            else {
                console.log(err, err.stack);
                return callback("ERROR (updateCategory)", err, data);
            }
        }
        var params = {
            TableName: tableName,
            Expected: {
                SystemId: {
                    Exists: false
                },
                Name: {
                    Exists: false
                }
            },
            Item: {
                SystemId: {
                    S: systemId
                },
                Name: {
                    S: newCategoryName
                }
            }
        };
        db.putItem(params, function(err, data) {
            if (err) {
                // if error, revert deletion of original category
                var params = {
                    TableName: tableName,
                    Item: {
                        SystemId: {
                            S: systemId
                        },
                        Name: {
                            S: categoryName
                        }
                    }
                };
                db.putItem(params, function() {
                    if (err.code === "ConditionalCheckFailedException")
                        return callback("category_exists");
                    else {
                        console.log("ERROR (updateCategory)", err, err.stack);
                        return callback(err, data);
                    }
                });
            } else {
                return dbEvents.replaceCategoryInEvents(systemId, categoryName, newCategoryName, callback);
            }
        });
    });
}

exports.createSchema = createSchema;
exports.deleteSchema = deleteSchema;
exports.checkIfCategoryExists = checkIfCategoryExists;
exports.getAllCategories = getAllCategories;
exports.putCategory = putCategory;
exports.deleteCategory = deleteCategory;
exports.updateCategory = updateCategory;