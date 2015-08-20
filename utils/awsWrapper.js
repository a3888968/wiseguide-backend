"use strict";

/*
This module is a wrapper for the AWS SDK which sets the region and API versions.
*/

var AWS = require('aws-sdk');
var region = 'eu-west-1';

AWS.config.update({
    region: region
});

AWS.config.apiVersions = {
    elastictranscoder: '2012-09-25',
    sqs: '2012-11-05',
    dynamodb: '2012-08-10'
};

exports.AWS = AWS;
exports.region = region;