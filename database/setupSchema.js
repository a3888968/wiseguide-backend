"use strict";

/*
This module wraps all of the createSchema and deleteSchema functions
from the other database modules into two functions which will create
and destroy for all database tables.
*/

var dbUsers = require('./users');
var dbSystems = require('./systems');
var dbEvents = require('./events');
var dbCategories = require('./categories');
var dbVenues = require('./venues');
var dbAgendas = require('./agendas');
var dbAgendaItems = require('./agendaItems');
var dbGeoEvents = require('./geoEvents');
var dbVenueCounters = require('./venueCounters');
var dbEventCounters = require('./eventCounters');
var dbSuggestedEvents = require('./suggestedEvents');
var async = require('async');

/* 
Creates all database schema.
Arguments:
- callback = function(err) : err is the error if one occurred
*/
function createSchema(callback) {
    async.series([
        dbSystems.createSchema,
        dbUsers.createSchema,
        dbEvents.createSchema,
        dbCategories.createSchema,
        dbVenues.createSchema,
        dbAgendas.createSchema,
        dbAgendaItems.createSchema,
        dbGeoEvents.createSchema,
        dbVenueCounters.createSchema,
        dbEventCounters.createSchema,
        dbSuggestedEvents.createSchema
    ], callback);
}

/* 
Destroys all database schema.
Arguments:
- callback = function(err) : err is the error if one occurred
*/
function deleteSchema(callback) {
    async.series([
        dbSystems.deleteSchema,
        dbUsers.deleteSchema,
        dbEvents.deleteSchema,
        dbCategories.deleteSchema,
        dbVenues.deleteSchema,
        dbAgendas.deleteSchema,
        dbAgendaItems.deleteSchema,
        dbGeoEvents.deleteSchema,
        dbVenueCounters.deleteSchema,
        dbEventCounters.createSchema,
        dbSuggestedEvents.deleteSchema
    ], callback);
}

exports.createSchema = createSchema;
exports.deleteSchema = deleteSchema;