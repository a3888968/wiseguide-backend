'use strict';

// This module is for interaction with SQS queues

var dbSystems = require('../database/systems');
var AWS = require('../utils/awsWrapper').AWS;
var sqs = new AWS.SQS();
var queueUrl;
tryGetQueueUrl(5);

function tryGetQueueUrl(attemptsRemaining) {
    if (attemptsRemaining === 0)
        throw new Error("Couldn't get SQS URL");
    sqs.getQueueUrl({
        QueueName: 'TrailappAnalysisQueue'
    }, function(err, data) {
        if (err)
            setTimeout(tryGetQueueUrl, 200 * (6 - attemptsRemaining), attemptsRemaining - 1);
        else
            queueUrl = data.QueueUrl;
    });
}


// Queue a full analysis of a given system - callback optional
// Callback has one argument - the error if one occurred
function queueSystemAnalysis(systemId, callback) {
    function wrappedCallback(err) {
        if (callback) return callback(err);
    }

    dbSystems.checkIfInAnalysisQueue(systemId, function(err, result) {
        console.log("already queued = ", result);
        if (err)
            return wrappedCallback(err);
        else if (result === null)
            return wrappedCallback("system_not_found");
        else if (result === true)
            return wrappedCallback();
        else if (result === false) {
            var params = {
                MessageBody: systemId,
                QueueUrl: queueUrl,
                DelaySeconds: 0
            };
            sqs.sendMessage(params, function(err, data) {
                if (err) {
                    console.log("error queueing");
                    return wrappedCallback(err);
                }
                else {
                    console.log("made it");
                    return dbSystems.setInAnalysisQueue(systemId, wrappedCallback);
                }
            });
            return wrappedCallback();
        } else
            return wrappedCallback("unexpected_condition");
    });
}


exports.queueSystemAnalysis = queueSystemAnalysis;