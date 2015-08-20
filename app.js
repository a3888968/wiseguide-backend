"use strict";

var config = require('./utils/config');
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var cors = require('cors');

var adminApi = require('./adminApi/api');
var api = require('./api/api');
var dbSetup = require('./database/setupSchema');

var app = express();

app.disable('trailAppReady');
app.disable('etag');

dbSetup.createSchema(function(err) {
    if (err)
        process.exit(1);
    else {
        // view engine setup
        app.set('views', path.join(__dirname, 'views'));
        app.set('view engine', 'jade');
        
        // uncomment after placing your favicon in /public
        if (!config.unitTesting)
            app.use(logger('dev'));

        app.use(cors());

        app.use(bodyParser.json());
        app.use(function(error, req, res, next) {
            if (error instanceof SyntaxError)
                return res.status(400).json({
                    Error: "invalid_json"
                }).send();
            else
                next();
        });
        app.use(bodyParser.urlencoded({
            extended: false
        }));
        app.use(cookieParser());

        app.use('/admin', adminApi);
        app.use('/api', api);

        // catch 404 and forward to error handler
        app.use(function(req, res, next) {
            var err = new Error('Not Found');
            err.status = 404;
            next(err);
        });

        // error handler
        app.use(function(err, req, res, next) {
            res.status(err.status || 500);
            if (err.status === 404)
                return res.status(404).json({
                    Error: "not_found"
                }).send();
            else {
                console.log("Uncaught error: ", err, err.stack);
                return res.status(500).send();
            }
        });

        app.enable('trailAppReady');
    }
});

module.exports = app;