"use strict";

/* 
Handles Admin API endpoints for the setting up of systems and admin-level activities.
*/

var express = require('express');
var router = express.Router();
var routerSystems = require('./systems');

router.use('/systems', routerSystems);

module.exports = router;