'use strict';

/* 
This module handles endpoints regarding geo-event logging. All endpoints begin /api/geoevents
*/

var express = require('express');
var dbGeoEvents = require('../database/geoEvents');
var dbVenues = require('../database/venues');
var moment = require('moment');

var router = express.Router();

/*
Logs entry to a venue
*/
router.post('/entry', function(req, res) {
    if (req.headers['content-type'] !== 'application/json')
        return res.status(400).json({
            Error: 'wrong_content_type'
        }).send();
    
    var entry = req.body;

    if (!(entry.hasKeys(['DeviceId', 'VenueId', 'Time'])))
        return res.status(400).json({
            Error: 'invalid_parameters'
        });

    for (var prop in entry) {
        if (typeof entry[prop] === 'string')
            entry[prop] = entry[prop].trim();
    }

    if (!(typeof entry.DeviceId === 'string' && entry.DeviceId))
        return res.status(400).json({
            Error: 'bad_device_id'
        }).send();

    if (!(typeof entry.VenueId === 'string' && entry.VenueId))
        return res.status(400).json({
            Error: 'bad_venue_id'
        }).send();

    if (!(typeof entry.Time === 'number' && moment(entry.Time).isValid()))
        return res.status(400).json({
            Error: 'bad_time'
        }).send();

    if (Math.abs(entry.Time - Date.now()) > 180000)
        return res.status(400).json({
            Error: 'time_unsynced'
        }).send();

    dbVenues.getVenueByIdRaw(req.systemId, entry.VenueId, function(err, ven) {
        if (err)
            return res.status(500).send();
        else if (!ven)
            return res.status(400).json({
                Error: 'venue_not_found'
            }).send();
        else {
            dbGeoEvents.putGeoEventEntry(req.systemId, entry, function(err) {
                return res.status(200).send();
            });
        }
    });
});


module.exports = router;
