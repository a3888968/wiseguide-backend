"use strict";

/* 
This module loads the config file from the path set in the TRAILAPP_CONFIG_FILE 
environment variable or the config.json file in the project root and exposes it
to other modules.
*/

var config;

if (process.env.TRAILAPP_CONFIG_FILE)
    config = require(require("path").resolve(process.env.TRAILAPP_CONFIG_FILE));
else
    config = require("../config.json");

module.exports = config;