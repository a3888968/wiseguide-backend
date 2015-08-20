"use strict";

/*
Handles database interactions to do with Users.
*/

var db = require('./dynamodb').db;
var dbSystems = require('./systems');
var config = require('../utils/config');
var async = require('async');

var tableName = config.tablePrefix + "Users";


/*
Creates the Users table schema.
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
            AttributeName: 'Username',
            AttributeType: 'S'
        }, {
            AttributeName: 'Email',
            AttributeType: 'S'
        }],
        KeySchema: [{
            AttributeName: 'SystemId',
            KeyType: 'HASH'
        }, {
            AttributeName: 'Username',
            KeyType: 'RANGE'
        }],
        GlobalSecondaryIndexes: [{
            IndexName: 'EmailIndex',
            KeySchema: [{
                AttributeName: 'SystemId',
                KeyType: 'HASH'
            }, {
                AttributeName: 'Email',
                KeyType: 'RANGE'
            }],
            Projection: {
                ProjectionType: 'ALL'
            },
            ProvisionedThroughput: {
                ReadCapacityUnits: 1,
                WriteCapacityUnits: 1
            }
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
Destroys the Users table schema.
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
Puts a new user in the database.
Arguments:
- systemId = string : the system ID to create the user for
- user = object : an object containing the required user properties
- system = object : an object containing the required system properties
- callback = function(err) : err is the error if one occurred
*/
function putUser(systemId, user, system, callback) {
    getUserByEmail(systemId, user.Email, function(err, existingUser) {
        if (existingUser)
            return callback("email_exists");
        var params = {
            Item: {
                SystemId: {
                    S: systemId
                },
                Username: {
                    S: user.Username
                },
                Email: {
                    S: user.Email
                },
                Name: {
                    S: user.Name
                },
                Biography: {
                    S: user.Biography
                },
                Summary: {
                    S: user.Summary
                },
                Password: {
                    S: user.Password
                },
                Role: {
                    SS: user.Role
                },
                System: {
                    M: dbSystems.convertSystemToDatabaseItem(system)
                }
            },
            TableName: tableName,
            Expected: {
                SystemId: {
                    Exists: false
                },
                Username: {
                    Exists: false
                }
            }
        };
        db.putItem(params, function(err, data) {
            if (err) {
                if (err.code === "ConditionalCheckFailedException")
                    return callback("username_exists");
                else {
                    console.log("ERROR (putUser)", err, err.stack);
                    return callback(err);
                }
            } else {
                return callback(err, data);
            }
        });
    });
}

/*
Updates an existing user in the database
Arguments:
- systemId = string : the system ID to modify a user for
- username = string : the username of the user to be updated
- newDetails = object : an object with just the properties to be updated specified
- callback = function(err) : err is the error if one occurred
*/
function updateUser(systemId, username, newDetails, callback) {
    var attributeUpdates = {};
    var allowedProperties = ["Email", "Name", "Biography", "Summary", "Password", "Role"];
    var stringSetProperties = ["Role"];
    for (var property in newDetails) {
        if (newDetails.hasOwnProperty(property) &&
            allowedProperties.indexOf(property) !== -1 &&
            newDetails[property]) {
            if (stringSetProperties.indexOf(property) !== -1)
                attributeUpdates[property] = {
                    Action: 'PUT',
                    Value: {
                        SS: newDetails[property]
                    }
                };
            else
                attributeUpdates[property] = {
                    Action: 'PUT',
                    Value: {
                        S: newDetails[property]
                    }
                };
        }
    }

    if (newDetails.Email) {
        getUserByEmail(systemId, newDetails.Email, function(err, existingUser) {
            if (existingUser && existingUser.Username !== username)
                return callback("email_exists");
            else
                doUpdate();
        });
    } else
        doUpdate();

    function doUpdate() {
        var params = {
            Key: {
                SystemId: {
                    S: systemId
                },
                Username: {
                    S: username
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
                Username: {
                    Exists: true,
                    Value: {
                        S: username
                    }
                }
            }
        };
        db.updateItem(params, function(err, data) {
            if (err) console.log("ERROR (updateUser)", err, err.stack);
            return callback(err);
        });
    }
}

/*
Updates all users in a system with new system details
Arguments:
- systemId = string : the system ID to modify a user for
- system = object : a database Item object containing a mapping of all the system's values
*/
function refreshSystemDetails(systemId, system, callback) {
    var attUpdate = {
        System: {
            Action: 'PUT',
            Value: {
                M: system
            }
        }
    };

    getAllUsersInSystem(systemId, function(err, users) {
        if (err)
            return callback(err);
        else if (!users)
            return callback();
        else {
            async.eachLimit(users, 2, doUpdate, function(err) {
                if (err)
                    console.log("refreshSystemDetails", err, err.stack);
                return callback(err);
            });
        }
    });

    function doUpdate(user, cb) {
        var params = {
            Key: {
                SystemId: {
                    S: systemId
                },
                Username: {
                    S: user.Username
                }
            },
            TableName: tableName,
            AttributeUpdates: attUpdate,
            Expected: {
                SystemId: {
                    Exists: true,
                    Value: {
                        S: systemId
                    }
                },
                Username: {
                    Exists: true,
                    Value: {
                        S: user.Username
                    }
                }
            }
        };
        db.updateItem(params, function(err, data) {
            return cb(err);
        });
    }
}

/*
Delete a user in the database.
Arguments:
- systemId = string : the ID of the system to delete the user from
- username = string : the username of the user to delete
- callback = function(err) : err is the error if one occurred
*/
function deleteUser(systemId, username, callback) {
    var params = {
        Key: {
            SystemId: {
                S: systemId
            },
            Username: {
                S: username
            }
        },
        TableName: tableName,
    };
    db.deleteItem(params, function(err, data) {
        if (err) {
            console.log("ERROR (deleteUser)", err, err.stack);
            return callback(err);
        } else {
            return callback(err);
        }
    });
}

/*
Get a user's details by looking up their username in the database.
Arguments:
- systemId = string : the ID of the system to find the user in
- username = string : the username of the user whose details are being requested
- callback = function(err, user) : err is the error if one occurred, user
				is the object containing the looked-up user's details
*/
function getUserByUsername(systemId, username, callback) {
    var params = {
        Key: {
            SystemId: {
                S: systemId
            },
            Username: {
                S: username
            }
        },
        TableName: tableName
    };
    db.getItem(params, function(err, data) {
        if (err) {
            console.log("ERROR (getUserByUsername)", err, err.stack);
            return callback(err);
        }

        var user;
        if (data && data.Item) {
            user = convertDatabaseItemToUser(data.Item);
        } else {
            user = null;
        }

        return callback(err, user);
    });
}

/*
Get a user's details by looking up their email address in the database.
Arguments:
- systemId = string : the ID of the system to find the user in
- email = string : the email address of the user whose details are being requested
- callback = function(err, user) : err is the error if one occurred, user
				is the object containing the looked-up user's details
*/
function getUserByEmail(systemId, email, callback) {
    var params = {
        KeyConditions: {
            SystemId: {
                ComparisonOperator: 'EQ',
                AttributeValueList: [{
                    S: systemId
                }]
            },
            Email: {
                ComparisonOperator: 'EQ',
                AttributeValueList: [{
                    S: email
                }]
            }
        },
        TableName: tableName,
        IndexName: 'EmailIndex',
        Select: 'ALL_PROJECTED_ATTRIBUTES'
    };
    db.query(params, function(err, data) {
        if (err) {
            console.log("ERROR (getUserByEmail)", err, err.stack);
            return callback(err);
        }

        var user;
        if (data && data.Count >= 1) {
            user = convertDatabaseItemToUser(data.Items[0]);
        } else {
            user = null;
        }

        return callback(err, user);
    });
}

/*
Get all users of a system
Arguments:
- systemId = string : the ID of the system to find the user in
- callback = function(err, users) : err is the error if one occurred, user
				is a list of objects containing the looked-up user's details
*/
function getAllUsersInSystem(systemId, callback) {
    var params = {
        KeyConditions: {
            SystemId: {
                ComparisonOperator: 'EQ',
                AttributeValueList: [{
                    S: systemId
                }]
            }
        },
        TableName: tableName
    };
    db.query(params, function(err, data) {
        if (err) {
            console.log("ERROR (getAllUsersInSystem)", err, err.stack);
            return callback(err);
        }

        var users = [];
        for (var i = 0; i < data.Count; i++) {
            users.push(convertDatabaseItemToUser(data.Items[i]));
        }

        return callback(err, users);
    });
}

/*
Converts a database Item to a user object by extracting the relevant
properties.
Arguments:
- item: the database Item to convert
Returns:
- userObj: the converted user object
*/
function convertDatabaseItemToUser(item) {
    var user = {};
    user.Summary = item.Summary.S;
    user.Name = item.Name.S;
    user.Biography = item.Biography.S;
    user.Email = item.Email.S;
    user.Username = item.Username.S;
    user.Password = item.Password.S;
    user.Role = item.Role.SS;
    user.SystemId = item.SystemId.S;
    user.System = dbSystems.convertDatabaseItemToSystem(item.System.M);
    return user;
}

exports.createSchema = createSchema;
exports.deleteSchema = deleteSchema;
exports.putUser = putUser;
exports.updateUser = updateUser;
exports.refreshSystemDetails = refreshSystemDetails;
exports.deleteUser = deleteUser;
exports.getUserByUsername = getUserByUsername;
exports.getUserByEmail = getUserByEmail;
exports.getAllUsersInSystem = getAllUsersInSystem;