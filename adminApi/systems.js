"use strict";

/* 
This module handles Admin API endpoints regarding systems. All endpoints begin /admin/systems
*/

var express = require('express');
var router = express.Router();
var dbSystems = require('../database/systems');
var utilsUsers = require('../users/utils');
var dbUsers = require('../database/users');
var hash = require('../users/hash');
var auth = require('../users/authentication');
var Stream = require('stream');
var async = require('async');
var awsWrapper = require('../utils/awsWrapper');
var s3 = new awsWrapper.AWS.S3();
var awsRegion = awsWrapper.region;
var multer = require('multer');
var fs = require('fs');
var _ = require('lodash');

var mwMulter = multer({
    dest: './uploads/',
    // rename: function(fieldname, filename) {
    //     return fieldname + filename + Date.now() + Math.random();
    // },
    limits: {
        fileSize: 20 * 1024 * 1024 // max 20MB upload
    },
    putSingleFilesInArray: true
});

// TODO a file cleanup function that accepts a callback function

/*
Creates a new system with the given system ID.
*/
router.post('/create/:systemId', mwMulter, function(req, res) {
    if ((req.headers['content-type'] || '').split(';')[0] !== 'multipart/form-data')
        return res.status(400).json({
            Error: 'wrong_content_type'
        }).send();

    if (!req.body.hasKeys(['data']) || !req.files.hasKeys(['logoImg', 'headerImg'/*, 'appIconImg'*/]))
        return res.status(400).json({
            Error: 'invalid_parameters'
        }).send();

    var data;
    try {
        data = JSON.parse(req.body.data);
    } catch (err) {
        if (err instanceof SyntaxError)
            return res.status(400).json({
                Error: 'invalid_json'
            }).send();
        console.log('ERROR (/create/:systemId [parsing JSON data])', err, err.stack);
        return res.status(500).send();
    }

    var config = data.Config;
    config.files = req.files;
    var user = data.User;
    var systemProps = data;
    systemProps.User = undefined;
    systemProps.Lock = false;
    systemProps.SystemId = req.params.systemId;

    dbSystems.putSystem(req.params.systemId, systemProps, function(err, data) {
        if (err) {
            if (err === "systemid_exists")
                return res.status(400).json({
                    Error: err
                }).send();
            else {
                console.log(err);
                return res.status(500).send();
            }
        } else {
            var clearPassword = user.Password;

            user.Password = hash.hashPassword(user.Password);
            user.Role = ["contributor", "admin"];
            user.SystemId = req.params.systemId;

            dbUsers.putUser(req.params.systemId, user, {
                SystemId: req.params.systemId,
                CenterLat: req.body.CenterLat,
                CenterLon: req.body.CenterLon,
                Lock: false
            }, function(err, data) {
                if (err) {
                    if (err === "username_exists" || err === "email_exists")
                        return res.status(400).json({
                            Error: err
                        }).send();
                    else {
                        console.log(err);
                        return res.status(500).send();
                    }
                } else {
                    auth.authenticateUser(user, clearPassword, function(token, expires) {
                        config.systemId = req.params.systemId;
                        deploy(config, function(err, endpoint) {
                            if(err) {
                                console.log(err);
                                return res.status(500).send();
                            }
                            else {
                                return res.status(200).json({
                                    Token: token,
                                    Expires: expires,
                                    User: utilsUsers.convertToPrivateUser(user),
                                    Endpoint: endpoint 
                                }).send();
                            }
                        });
                    });
                }
            });
        }
    });
});



/*
Deploys a new front-end
*/
function deploy(params, callback) {
    // Create the config file
    var configJs = [
        "(function(){'use strict';angular.module('trailapp.config', [])",
        ".constant('trailappConfig', ",
        JSON.stringify({
            HEREAppId: '',
            HEREAppCode: '',
            backendUrl: '',
            systemId: params.systemId,
            backgroundColor: params.backgroundColor,
            foregroundColor: params.foregroundColor,
            title: params.title,
            homePageBodyHtml: params.homePageBodyHtml
        }),
        ");})();",
    ].join('');

    // Create the S3 bucket
    createBucket('trailapp-' + params.systemId, function(err, data) {
        if (err) {
            console.log("createBucket error", err);
            return callback(new Error('deployment_failure'));
        }

        // List the files to copy
        var files = [];
        var getFiles = function(nextMarker) {
            // Copy files from the source bucket to the customer bucket
            s3.listObjects({Bucket:'trailapp-src', Marker:nextMarker}, function(err,data) {
                if (err) {
                    console.log("get files error", err);
                    return callback(new Error('deployment_failure'));
                }
                files = files.concat(data.Contents);
                if(data.IsTruncated) {
                    getFiles(data.NextMarker);
                }
                else {
                    copyFiles();
                }
            });
        };
        getFiles();

        // Copy the files from one bucket to the other
        var copyFiles = function() {
            async.eachLimit(files, 5, function(file, cb) {
                s3.copyObject({
                    Bucket: 'trailapp-' + params.systemId,
                    CopySource: 'trailapp-src/' + file.Key,
                    Key: file.Key,
                    ACL: 'public-read'
                }, cb);
            }, function(err) {
                if(err) {
                    console.log("copy error", err);
                    return callback(new Error('deployment_failure'));
                }
                else {
                    var keyStreams = []; // array of objects with properties 'key' & 'stream'
                    // Create a stream for config.js
                    var s = new Stream.Readable();
                    s._read = function noop() {};
                    s.push(configJs);
                    s.push(null);

                    keyStreams.push({
                        key: 'config.js',
                        stream: s
                    });

                    _.forOwn(params.files, function(files, fieldName) {
                        var file = files[0];
                        var fileStream = fs.createReadStream(file.path);
                        var key;
                        switch (fieldName) {
                            // TODO ensure extensions are what we say they are (png/jpeg)
                            case 'logoImg':
                                key = 'images/logo.png';
                                break;
                            case 'headerImg':
                                key = 'images/header.jpg';
                                break;
                            // case 'appIconImg':
                            //     key = 'resources/icon.png';
                            //     break;
                            default:
                                break;
                        }

                        keyStreams.push({
                            key: key,
                            stream: fileStream
                        });
                    });
                    
                    // Upload streams to the customer bucket
                    async.eachSeries(keyStreams, function(keyStream, cb) {
                        s3.upload({
                            Bucket: 'trailapp-' + params.systemId,
                            Key: keyStream.key,
                            Body: keyStream.stream,
                            ACL: 'public-read'
                        }, undefined, function(err, data) {
                            if (err) {
                                console.log('upload error', err);
                                return cb(new Error('deployment_failure'));
                            }
                            return cb();
                        });
                    }, function(err) {
                        if (err) return callback(err);
                        return callback(
                            undefined, 
                            'http://trailapp-' + params.systemId + '.s3-website-' + awsRegion + '.amazonaws.com'
                        );
                    });
                }
            });
        };
    });
}

// Creates a public bucket and uploads a folder to it
function createBucket(bucketName, callback) {
    var params = {
        Bucket: bucketName,
        ACL: 'public-read',
        CreateBucketConfiguration: {
            LocationConstraint: awsRegion
        }
    };
    s3.createBucket(params, function(err, data) {
        if (err) return callback(err);
        else {
            var params = {
                Bucket: bucketName,
                WebsiteConfiguration: {
                    ErrorDocument: {
                        Key: 'index.html'
                    },
                    IndexDocument: {
                        Suffix: 'index.html'
                    }
                }
            };
            s3.putBucketWebsite(params, function(err, data) {
                if (err) return callback(err);
                else return callback(undefined);
            });
        }
    });
}


module.exports = router;