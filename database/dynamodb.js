"use strict";

/*
Exports the AWS DynamoDB object for use in other database modules.
*/

var AWS = require('../utils/awsWrapper').AWS;
var db = new AWS.DynamoDB();
//var db = new AWS.DynamoDB({ endpoint: new AWS.Endpoint('http://localhost:8000') });//new AWS.DynamoDB();

exports.db = db;