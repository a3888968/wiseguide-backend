"use strict";

/* 
This module handles endpoints regarding venues. All endpoints begin /api/venues
*/

var express = require('express');
var uuid = require('node-uuid');
var dbEvents = require('../database/events');
var dbVenues = require('../database/venues');
var dbVenueCounters = require('../database/venueCounters');
var auth = require('../users/authentication');
var utilsVenues = require('../venues/utils');
var utils = require('../utils/utils');
var geocoder = require('node-geocoder').getGeocoder('openstreetmap', 'http');
var async = require('async');

var router = express.Router();

/*
Creates a new venue. First validates, then puts the venue into the database.
*/
router.post('/create', function(req, res) {
    if (!auth.checkAuthenticated(req, res)) return;
    if (!auth.checkSystemUnlocked(req, res)) return;

    if (req.user.Role.indexOf("contributor") === -1)
        return res.status(401).json({
            Error: "not_permitted"
        }).send();

    if (req.headers['content-type'] != "application/json")
        return res.status(400).json({
            Error: "wrong_content_type"
        }).send();

    var venue = req.body;

    if (!venue.hasKeys(['Name', 'Description', 'Lat', 'Lon', 'Address', 'Rooms']))
        return res.status(400).json({
            Error: "invalid_parameters"
        }).send();

    var validationError = utilsVenues.validateVenueProperties(venue, true);
    if (validationError)
        return res.status(400).json({
            Error: validationError
        }).send();

    venue.VenueId = uuid.v4();
    venue.Contributor = req.user.Username;

    dbVenues.putVenue(req.systemId, venue, function(err, data) {
        if (err)
            return res.status(500).send();
        else
            return res.status(200).json({
                VenueId: venue.VenueId
            }).send();
    });
});

/*
Modifies a venue in the database. First checks input is well-formed (using same
criteria as /create) and that user has permission to edit then updates the venue
in the database.
*/
router.post('/edit/:venueId', function(req, res) {
    if (!auth.checkAuthenticated(req, res)) return;
    if (!auth.checkSystemUnlocked(req, res)) return;

    if (req.user.Role.indexOf("contributor") === -1)
        return res.status(401).json({
            Error: "not_permitted"
        }).send();

    if (req.headers['content-type'] != "application/json")
        return res.status(400).json({
            Error: "wrong_content_type"
        }).send();

    var venue = req.body;

    if (!venue.hasAllowedKeys(['Name', 'Description', 'Lat', 'Lon', 'Address']))
        return res.status(400).json({
            Error: "invalid_parameters"
        }).send();

    var validationError = utilsVenues.validateVenueProperties(venue, false);
    if (validationError)
        return res.status(400).json({
            Error: validationError
        }).send();

    var contributorCondition;
    if (req.user.Role.indexOf("admin") === -1)
        contributorCondition = req.user.Username;

    dbVenues.updateVenue(req.systemId, req.params.venueId, venue, contributorCondition, function(err, data) {
        if (err) {
            if (err === "condition_violated")
                return res.status(400).json({
                    Error: err
                }).send();
            else
                return res.status(500).send();
        } else
            return res.status(200).send();
    });
});

/*
Deletes a venue in the database.
*/
router.post('/delete/:venueId', function(req, res) {
    if (!auth.checkAuthenticated(req, res)) return;
    if (!auth.checkSystemUnlocked(req, res)) return;

    if (req.user.Role.indexOf("contributor") === -1)
        return res.status(401).json({
            Error: "not_permitted"
        }).send();

    var contributorCondition;
    if (req.user.Role.indexOf("admin") === -1)
        contributorCondition = req.user.Username;

    dbVenues.deleteVenue(req.systemId, req.params.venueId, contributorCondition, function(err, data) {
        if (err) {
            if (err === "condition_violated" || err === "venue_has_events")
                return res.status(400).json({
                    Error: err
                }).send();
            else
                return res.status(500).send();
        } else
            return res.status(200).send();
    });
});

/*
Adds a new room to a venue
*/
router.post('/addroom/:venueId', function(req, res) {
    if (!auth.checkAuthenticated(req, res)) return;
    if (!auth.checkSystemUnlocked(req, res)) return;

    if (req.user.Role.indexOf("contributor") === -1)
        return res.status(401).json({
            Error: "not_permitted"
        }).send();

    if (req.headers['content-type'] != "application/json")
        return res.status(400).json({
            Error: "wrong_content_type"
        }).send();

    var room = req.body;

    if (!room.hasKeys(['Name']))
        return res.status(400).json({
            Error: "invalid_parameters"
        }).send();

    if (typeof room.Name === 'string') room.Name = room.Name.trim();

    if (!(typeof room.Name === "string" && room.Name.length >= 1 && room.Name.length <= 40))
        return res.status(400).json({
            Error: "bad_name"
        }).send();

    var contributorCondition;
    if (req.user.Role.indexOf("admin") === -1)
        contributorCondition = req.user.Username;

    dbVenues.addOrDeleteVenueRoom(req.systemId, req.params.venueId, [room.Name], "ADD", contributorCondition, function(err) {
        if (err) {
            if (err === "condition_violated")
                return res.status(400).json({
                    Error: err
                }).send();
            else
                return res.status(500).send();
        } else
            return res.status(200).send();
    });
});

/*
Deletes a room from a venue
*/
router.post('/deleteroom/:venueId', function(req, res) {
    if (!auth.checkAuthenticated(req, res)) return;
    if (!auth.checkSystemUnlocked(req, res)) return;

    if (req.user.Role.indexOf("contributor") === -1)
        return res.status(401).json({
            Error: "not_permitted"
        }).send();

    if (req.headers['content-type'] != "application/json")
        return res.status(400).json({
            Error: "wrong_content_type"
        }).send();

    var room = req.body;

    if (!room.hasKeys(['Name']))
        return res.status(400).json({
            Error: "invalid_parameters"
        }).send();

    if (typeof room.Name === 'string') room.Name = room.Name.trim();

    if (!(typeof room.Name === "string" && room.Name.length >= 1 && room.Name.length <= 40))
        return res.status(400).json({
            Error: "bad_name"
        }).send();

    var contributorCondition;
    if (req.user.Role.indexOf("admin") === -1)
        contributorCondition = req.user.Username;

    dbVenues.addOrDeleteVenueRoom(req.systemId, req.params.venueId, [room.Name], "DELETE", contributorCondition, function(err) {
        if (err) {
            if (err === "condition_violated" || err === "room_has_events")
                return res.status(400).json({
                    Error: err
                }).send();
            else
                return res.status(500).send();
        } else
            return res.status(200).send();
    });
});

/*
Look up the details of a venue by its ID.
*/
router.get('/details/:venueId', function(req, res) {
    dbVenues.getVenueById(req.systemId, req.params.venueId, function(err, venue) {
        if (err)
            return res.status(500).send();
        else if (!venue)
            return res.status(404).json({
                Error: "venue_not_found"
            }).send();
        else {
            dbEvents.getEventOccurrencesByVenueId(req.systemId, req.params.venueId, function(err, occs) {
                if (err) {
                    return res.status(500).send();
                } else {
                    occs.sort(function(a, b) {
                        return a.Start - b.Start;
                    });
                    venue.EventOccurrences = occs;
                    return res.status(200).json(utilsVenues.convertToVenueFull(venue, !!req.user)).send();
                }
            });
        }
    });
});

/*
Gets a list of all venues sorted alphabetically
*/
router.get('/all', function(req, res) {
    dbVenues.getAllVenues(req.systemId, function(err, venues) {
        if (err)
            return res.status(500).send();
        else {
            var venuesBasic = [];
            var center;
            if (venues.length) {
                var minLat = 1000,
                    minLon = 1000;
                var maxLat = -1000,
                    maxLon = -1000;
                for (var i = 0; i < venues.length; i++) {
                    var ven = venues[i];
                    if (ven.Lat > maxLat) maxLat = ven.Lat;
                    if (ven.Lat < minLat) minLat = ven.Lat;
                    if (ven.Lon > maxLon) maxLon = ven.Lon;
                    if (ven.Lon < minLon) minLon = ven.Lon;
                    venuesBasic.push(utilsVenues.convertToVenueBasic(ven, !!req.user));
                }
                center = {
                    Lat: (minLat + maxLat) / 2,
                    Lon: (minLon + maxLon) / 2
                };
                venuesBasic.sort(function(a, b) {
                    return utils.getDistance(a.Lat, a.Lon, center.Lat, center.Lon) - utils.getDistance(b.Lat, b.Lon, center.Lat, center.Lon);
                });
            }

            return res.status(200).json({
                Venues: venuesBasic,
                Center: center
            }).send();
        }
    });
});

/*
Gets a list of all venues sorted alphabetically
*/
router.get('/by/:contributor', function(req, res) {
    if (!auth.checkAuthenticated(req, res)) return;
    
    dbVenues.getAllVenues(req.systemId, function(err, venues) {
        if (err)
            return res.status(500).send();
        else {
            var venuesBasic = [];
            if (venues.length) {
                for (var i = 0; i < venues.length; i++) {
                    var ven = venues[i];
                    if(ven.Contributor.toLowerCase() === req.params.contributor.toLowerCase()) 
                        venuesBasic.push(utilsVenues.convertToVenueBasic(ven, !!req.user));
                }
            }
            return res.status(200).json({
                Venues: venuesBasic
            }).send();
        }
    });
});

/*
Endpoint that gets a list of all venues sorted by distance from an address
*/
router.get('/near/:query', function(req, res) {
    geocoder.geocode(req.params.query + " " + req.system.AppendToLocationQuery, function(err, data) {
        if (err || data.length < 1)
            return res.status(404).json({
                Error: "location_not_found"
            }).send();
        else {
            data.sort(function(a, b) {
                return utils.getDistance(a.latitude, a.longitude, req.system.Center.Lat, req.system.Center.Lon) - utils.getDistance(b.latitude, b.longitude, req.system.Center.Lat, req.system.Center.Lon);
            });
            return getVenuesNearPoint(parseFloat(data[0].latitude), parseFloat(data[0].longitude), req, res);
        }
    });
});

/*
Endpoint that gets a list of all venues sorted by distance from a geo-coordinate
*/
router.get('/near/:lat/:lon', function(req, res) {
    var lat = parseFloat(req.params.lat);
    var lon = parseFloat(req.params.lon);
    if (isNaN(lat) || lat < -90.0 || lat > 90.0) return res.status(400).json({
        Error: "bad_lat"
    });
    if (isNaN(lon) || lon < -180.0 || lon > 180.0) return res.status(400).json({
        Error: "bad_lon"
    });
    return getVenuesNearPoint(lat, lon, req, res);
});

/*
Endpoint that returns analytics for all venues
*/
router.get('/analytics', function(req, res) {
    if (!auth.checkAuthenticated(req, res)) return;
    if (req.user.Role.indexOf('admin') === -1)
        return res.status(401).json({
            Error: 'not_permitted'
        }).send();

    dbVenueCounters.getPopularVenues(req.systemId, function(err, venues) {
        if (err) return res.status(500).send();
        return res.status(200).json({
            Venues: venues
        }).send();
    });
});

/*
Actual logic for getting a list of all venues sorted by distance from a geo-coordinate
*/
function getVenuesNearPoint(lat, lon, req, res) {
    dbVenues.getAllVenues(req.systemId, function(err, venues) {
        if (err)
            return res.status(500).send();
        else {
            venues.sort(function(a, b) {
                return utils.getDistance(a.Lat, a.Lon, lat, lon) - utils.getDistance(b.Lat, b.Lon, lat, lon);
            });
            var venuesBasic = [];
            for (var i = 0; i < venues.length; i++) {
                venuesBasic.push(utilsVenues.convertToVenueBasic(venues[i], !!req.user));
            }
            var responseObj = {
                Venues: venuesBasic,
                LookedUpLocation: {
                    Lat: lat,
                    Lon: lon
                }
            };
            return res.status(200).json(responseObj).send();
        }
    });
}

module.exports = router;