"use strict";

/* 
Handles non-admin API endpoints
*/

var express = require('express');
var router = express.Router();
var auth = require('../users/authentication');
var routerUsers = require('./users');
var routerEvents = require('./events');
var routerCategories = require('./categories');
var routerVenues = require('./venues');
var routerSystems = require('./systems');
var routerAgendas = require('./agendas');
var routerGeoEvents = require('./geoEvents');

router.use(auth.parseSystemIdOrAccessToken);
router.use('/users', routerUsers);
router.use('/events', routerEvents);
router.use('/categories', routerCategories);
router.use('/venues', routerVenues);
router.use('/system', routerSystems);
router.use('/agendas', routerAgendas);
router.use('/geoevents', routerGeoEvents);

module.exports = router;