"use strict";

/* 
This module handles endpoints regarding events. All endpoints begin /api/events
*/

var _ = require('lodash');
var express = require('express');
var dbEvents = require('../database/events');
var dbSuggestedEvents = require('../database/suggestedEvents');
var dbEventCounters = require('../database/eventCounters');
var utilsQueue = require('../utils/queue');
var utilsEvents = require('../events/utils');
var utils = require('../utils/utils');
var uuid = require('node-uuid');
var auth = require('../users/authentication');
var moment = require('moment');
var geocoder = require('node-geocoder').getGeocoder('openstreetmap', 'http');

var router = express.Router();



/*
Creates a new event. First validates, then puts the event into the database.
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

    var theEvent = req.body;

    if (!theEvent.hasKeys(['Name', 'Categories', 'Description', 'Occurrences']))
        return res.status(400).json({
            Error: "invalid_parameters"
        }).send();

    var validationError = utilsEvents.validateEventProperties(theEvent, true);
    if (validationError)
        return res.status(400).json({
            Error: validationError
        }).send();

    theEvent.SystemId = req.systemId;
    theEvent.EventId = uuid.v4();
    theEvent.Contributor = req.user.Username;

    for (var i = 0; i < theEvent.Occurrences.length; i++) {
        theEvent.Occurrences[i].OccurrenceId = uuid.v4();
    }

    dbEvents.putEvent(req.systemId, theEvent, function(err, data) {
        if (err) {
            if (["bad_categories", "bad_room", "bad_venue"].indexOf(err) !== -1)
                return res.status(400).json({
                    Error: err
                }).send();
            else
                return res.status(500).send();
        } else {
            return res.status(200).json({
                EventId: theEvent.EventId
            }).send();
        }
    });
});

/*
Modifies all of an event's occurrences in the database. First checks input is well-formed 
(using same criteria as /create) and that user has permission to edit then updates the event
in the database.
*/
router.post('/edit/:eventId', function(req, res) {
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

    var ev = req.body;

    if (!ev.hasAllowedKeys(['Name', 'Description', 'Categories']))
        return res.status(400).json({
            Error: "invalid_parameters"
        }).send();

    var validationError = utilsEvents.validateEventProperties(ev, false);
    if (validationError)
        return res.status(400).json({
            Error: validationError
        }).send();

    var contributorCondition;
    if (req.user.Role.indexOf("admin") === -1)
        contributorCondition = req.user.Username;

    dbEvents.updateEventOccurrencesByEventId(req.systemId, req.params.eventId, ev, contributorCondition, function(err) {
        if (err) {
            if (err === "condition_violated" || err === "bad_categories")
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
Deletes all of an event's occurrences in the database. First checks that user has permission to
delete this event then deletes it in the database.
*/
router.post('/delete/:eventId', function(req, res) {
    if (!auth.checkAuthenticated(req, res)) return;
    if (!auth.checkSystemUnlocked(req, res)) return;

    if (req.user.Role.indexOf("contributor") === -1)
        return res.status(401).json({
            Error: "not_permitted"
        }).send();

    var contributorCondition;
    if (req.user.Role.indexOf("admin") === -1)
        contributorCondition = req.user.Username;

    dbEvents.deleteEventOccurrencesByEventId(req.systemId, req.params.eventId, contributorCondition, function(err) {
        if (err) {
            if (err === "condition_violated")
                return res.status(400).json({
                    Error: err
                }).send();
            else
                return res.status(500).send();
        } else {
            res.status(200).send();
            utilsQueue.queueSystemAnalysis(req.systemId);
            return;
        }
    });
});

/*
Creates a new event occurrence. First validates, then puts the occurrence into the database.
*/
router.post('/createoccurrence/:eventId', function(req, res) {
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

    var occ = req.body;

    if (!occ.hasKeys(['Start', 'End', 'VenueId', 'Room']))
        return res.status(400).json({
            Error: "invalid_parameters"
        }).send();

    if (!moment(occ.Start).isBefore(occ.End))
        return res.status(400).json({
            Error: "bad_start_end"
        }).send();

    occ.OccurrenceId = uuid.v4();

    var contributorCondition;
    if (req.user.Role.indexOf("admin") === -1)
        contributorCondition = req.user.Username;

    dbEvents.putEventOccurrence(req.systemId, req.params.eventId, occ, contributorCondition, function(err, data) {
        if (err) {
            if (["condition_violated", "bad_room", "bad_venue"].indexOf(err) !== -1)
                return res.status(400).json({
                    Error: err
                }).send();
            else
                return res.status(500).send();
        } else {
            return res.status(200).json({
                OccurrenceId: occ.OccurrenceId
            }).send();
        }
    });
});

/*
Edits an existing event occurrence. First validates, then updates the occurrence in the database.
*/
router.post('/editoccurrence/:occurrenceId', function(req, res) {
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

    var occ = req.body;

    if (!occ.hasAllowedKeys(['Start', 'End', 'VenueId', 'Room']))
        return res.status(400).json({
            Error: "invalid_parameters"
        }).send();

    if (occ.hasKeys(['Start', 'End']) && !moment(occ.Start).isBefore(occ.End))
        return res.status(400).json({
            Error: "bad_start_end"
        }).send();

    if (occ.hasOwnProperty('VenueId') && !occ.hasOwnProperty('Room'))
        return res.status(400).json({
            Error: "cant_specify_venue_without_room"
        }).send();

    var contributorCondition;
    if (req.user.Role.indexOf("admin") === -1)
        contributorCondition = req.user.Username;

    dbEvents.updateEventOccurrence(req.systemId, req.params.occurrenceId, occ, contributorCondition, function(err, data) {
        if (err) {
            if (["condition_violated", "bad_venue"].indexOf(err) !== -1)
                return res.status(400).json({
                    Error: err
                }).send();
            else
                return res.status(500).send();
        } else {
            return res.status(200).json({
                OccurrenceId: occ.OccurrenceId
            }).send();
        }
    });
});

/*
Deletes a single event occurrence.
*/
router.post('/deleteoccurrence/:occurrenceId', function(req, res) {
    if (!auth.checkAuthenticated(req, res)) return;
    if (!auth.checkSystemUnlocked(req, res)) return;

    if (req.user.Role.indexOf("contributor") === -1)
        return res.status(401).json({
            Error: "not_permitted"
        }).send();

    var contributorCondition;
    if (req.user.Role.indexOf("admin") === -1)
        contributorCondition = req.user.Username;

    dbEvents.deleteEventOccurrence(req.systemId, req.params.occurrenceId, contributorCondition, function(err, data) {
        if (err) {
            if (["condition_violated"].indexOf(err) !== -1)
                return res.status(400).json({
                    Error: err
                }).send();
            else
                return res.status(500).send();
        } else {
            res.status(200).send();
            utilsQueue.queueSystemAnalysis(req.systemId);
            return;
        }
    });
});

/*
Gets a list of all event occurrences
*/
router.get('/all', handleAll);
router.get('/all/:nextToken', handleAll);

function handleAll(req, res) {
    var nextToken;
    try {
        if (req.params.nextToken) nextToken = JSON.parse(req.params.nextToken);
    } catch (err) {
        return res.status(400).json({
            Error: "bad_next_token"
        }).send();
    }
    var params = processQueryParameters(req.query);
    if (!params)
        return res.status(400).json({
            Error: "bad_query"
        }).send();
    if (params.Sort !== "Start" && params.Sort !== "Name")
        return res.status(400).json({
            Error: "bad_query"
        }).send();


    var result = [];
    get();

    function get() {
        dbEvents.getAllEventOccurrences(req.systemId, nextToken, params, function(err, occs, lastEvalKey) {
            if (err)
                return res.status(500).send();
            else {
                for (var i = 0; i < occs.length; i++) {
                    result.push(utilsEvents.convertToOccurrenceFull(occs[i], !!req.user));
                }
                if(result.length >= 15 || !lastEvalKey) {
                    return res.status(200).json({
                        EventOccurrences: result,
                        NextToken: JSON.stringify(lastEvalKey)
                    }).send();
                }
                else {
                    nextToken = lastEvalKey;
                    get();
                }
            }
        });
    }
}

/*
Gets a list of event occurrences filtered by a query on the event name
*/
router.get('/search/:eventName', handleSearch);
router.get('/search/:eventName/:nextToken', handleSearch);

function handleSearch(req, res) {
    var nextToken;
    try {
        if (req.params.nextToken) nextToken = JSON.parse(req.params.nextToken);
    } catch (err) {
        return res.status(400).json({
            Error: "bad_next_token"
        }).send();
    }
    var params = processQueryParameters(req.query);
    if (!params)
        return res.status(400).json({
            Error: "bad_query"
        }).send();
    if (params.Sort !== "Start")
        return res.status(400).json({
            Error: "bad_query"
        }).send();

    var result = [];
    get();

    function get() {
        dbEvents.getEventOccurrencesByName(req.systemId, req.params.eventName.trim(), nextToken, params, function(err, occs, lastEvalKey) {
            if (err)
                return res.status(500).send();
            else {
                for (var i = 0; i < occs.length; i++) {
                    result.push(utilsEvents.convertToOccurrenceFull(occs[i], !!req.user));
                }
                if(result.length >= 15 || !lastEvalKey) {
                    return res.status(200).json({
                        EventOccurrences: result,
                        NextToken: JSON.stringify(lastEvalKey)
                    }).send();
                }
                else {
                    nextToken = lastEvalKey;
                    get();
                }
            }
        });
    }
}

/*
Gets a list of event occurrences filtered by category
*/
router.get('/category/:cat', handleCategory);
router.get('/category/:cat/:nextToken', handleCategory);

function handleCategory(req, res) {
    var nextToken;
    try {
        if (req.params.nextToken) nextToken = JSON.parse(req.params.nextToken);
    } catch (err) {
        return res.status(400).json({
            Error: "bad_next_token"
        }).send();
    }
    var params = processQueryParameters(req.query);
    if (!params)
        return res.status(400).json({
            Error: "bad_query"
        }).send();
    if (params.Sort !== "Start" && params.Sort !== "Name")
        return res.status(400).json({
            Error: "bad_query"
        }).send();

    var result = [];
    get();

    function get() {
        dbEvents.getEventOccurrencesByCategory(req.systemId, req.params.cat, nextToken, params, function(err, occs, lastEvalKey) {
            if (err)
                return res.status(500).send();
            else {
                for (var i = 0; i < occs.length; i++) {
                    result.push(utilsEvents.convertToOccurrenceFull(occs[i], !!req.user));
                }
                if(result.length >= 15 || !lastEvalKey) {
                    return res.status(200).json({
                        EventOccurrences: result,
                        NextToken: JSON.stringify(lastEvalKey)
                    }).send();
                }
                else {
                    nextToken = lastEvalKey;
                    get();
                }
            }
        });
    }
}

/*
Gets a list of event occurrences ongoing at certain time
*/
router.get('/ongoing/:time', function(req, res) {
    var params = processQueryParameters(req.query);
    if (!params)
        return res.status(400).json({
            Error: "bad_query"
        }).send();
    if (params.Sort !== "Start" && params.Sort !== "Name" && params.Sort !== "Distance")
        return res.status(400).json({
            Error: "bad_query"
        }).send();
    if (params.Sort === "Start" && (params.Start || params.End))
        return res.status(400).json({
            Error: "bad_query"
        }).send();

    if (params.Sort === "Distance" && params.Address) {
        geocoder.geocode(params.Address + " " + req.system.AppendToLocationQuery, function(err, data) {
            if (err || data.length < 1)
                return res.status(404).json({
                    Error: "location_not_found"
                }).send();
            else {
                data.sort(function(a, b) {
                    return utils.getDistance(a.latitude, a.longitude, req.system.Center.Lat, req.system.Center.Lon) - utils.getDistance(b.latitude, b.longitude, req.system.Center.Lat, req.system.Center.Lon);
                });
                params.Lat = parseFloat(data[0].latitude);
                params.Lon = parseFloat(data[0].longitude);
                return get();
            }
        });
    } else {
        return get();
    }

    function get() {
        dbEvents.getEventOccurrencesOngoingAtTime(req.systemId, req.params.time, function(err, occs) {
            if (err)
                return res.status(500).send();
            else {
                if (params.Lat) params.Lat = parseFloat(params.Lat);
                if (params.Lon) params.Lon = parseFloat(params.Lon);

                var minLat = 9999,
                    minLon = 9999,
                    maxLat = -9999,
                    maxLon = -9999;
                for (var i = 0; i < occs.length; i++) {
                    occs[i] = utilsEvents.convertToOccurrenceFull(occs[i], !!req.user);
                    if (occs[i].Venue.Lat > maxLat) maxLat = occs[i].Venue.Lat;
                    if (occs[i].Venue.Lon > maxLon) maxLon = occs[i].Venue.Lon;
                    if (occs[i].Venue.Lat < minLat) minLat = occs[i].Venue.Lat;
                    if (occs[i].Venue.Lon < minLon) minLon = occs[i].Venue.Lon;
                }
                // If sorting by distance but no center specified, calculate
                // center of all venues in result so we can sort from there
                if (params.Sort === "Distance" && params.Lat === undefined && params.Lon === undefined) {
                    params.Lat = (minLat + maxLat) / 2;
                    params.Lon = (minLon + maxLon) / 2;
                }
                // Sort results as required
                occs.sort(function(a, b) {
                    if (params.Sort === "Start")
                        return a.Start - b.Start;
                    else if (params.Sort === "Name")
                        return a.Event.Name.localeCompare(b.Event.Name);
                    else if (params.Sort === "Distance")
                        return utils.getDistance(a.Venue.Lat, a.Venue.Lon, params.Lat, params.Lon) -
                            utils.getDistance(b.Venue.Lat, b.Venue.Lon, params.Lat, params.Lon);
                });
                var responseObj = {
                    EventOccurrences: occs
                };
                if (params.Sort === "Distance")
                    responseObj.LookedUpLocation = {
                        Lat: params.Lat,
                        Lon: params.Lon
                    };
                return res.status(200).json(responseObj).send();
            }
        });
    }
});

/*
Gets a list of all events created by a specific user
*/
router.get('/by/:contributor', function(req, res) {
    if (!auth.checkAuthenticated(req, res)) return;

    dbEvents.getEventOccurrencesByContributor(req.systemId, req.params.contributor, function(err, occs) {
        if (err)
            return res.status(500).send();
        else {
            var grouped = _.groupBy(occs, function(occ) {
                return occ.Event.EventId;
            });
            var evs = [];
            for(var iii in grouped) {
                evs.push(utilsEvents.convertToEventBasic(grouped[iii][0].Event, !!req.user));
            }
            return res.status(200).json({
                Events: evs
            }).send();
        }
    });
});

/*
Gets an event's details and its occurrences
*/
router.get('/details/:eventId', function(req, res) {
    dbEvents.getEventOccurrencesByEventId(req.systemId, req.params.eventId, function(err, occs) {
        if (err)
            return res.status(500).send();
        else if (!occs || occs.length === 0)
            return res.status(404).json({
                Error: "event_not_found"
            }).send();
        else {
            var ev = occs[0].Event;
            ev.EventOccurrences = occs;
            return res.status(200).json(utilsEvents.convertToEventFull(ev, !!req.user)).send();
        }
    });
});


/*
Gets a list of suggested events similar to another event
*/
router.get('/suggested/:eventId', function(req, res) {
    dbSuggestedEvents.getSuggestedEvents(req.systemId, req.params.eventId, function(err, evs) {
        if (err)
            return res.status(500).send();
        else {
            for (var i = 0; i < evs.length; i++) {
                evs[i] = utilsEvents.convertToEventBasic(evs[i], !!req.user);
            }
            return res.status(200).json({
                Events: evs
            }).send();
        }
    });
});

/*
Endpoint that returns analytics for all events
*/
router.get('/analytics', function(req, res) {
    if (!auth.checkAuthenticated(req, res)) return;
    if (req.user.Role.indexOf('admin') === -1)
        return res.status(401).json({
            Error: 'not_permitted'
        }).send();

    dbEventCounters.getPopularEvents(req.systemId, function(err, events) {
        if (err) return res.status(500).send();
        return res.status(200).json({
            Events: events
        }).send();
    });
});

/*
Turns a query into a parameter object that can be passed to the database functions
to enable sorting and filtering.
Returns FALSE if an invalid set of parameters have been specified
*/
function processQueryParameters(queryObject) {
    var start;
    if (!queryObject)
        return {
            Sort: 'Start'
        };
    else if (!queryObject.sort) {
        if (Object.keys(queryObject).length > 0) return false;
        else return {
            Sort: 'Start'
        };
    } else if (queryObject.sort === "start") {
        if (queryObject.end) {
            if (!queryObject.start)
                return false;
            start = parseInt(queryObject.start);
            var end = parseInt(queryObject.end);
            if (isNaN(start) || isNaN(end))
                return false;
            if (moment(end).isBefore(start))
                return false;
            return {
                Sort: 'Start',
                Start: queryObject.start,
                End: queryObject.end
            };
        } else if (queryObject.start) {
            start = parseInt(queryObject.start);
            if (isNaN(start))
                return false;
            return {
                Sort: 'Start',
                Start: queryObject.start
            };
        } else
            return {
                Sort: 'Start'
            };
    } else if (queryObject.sort === "name") {
        if (Object.keys(queryObject).length > 1) return false;
        return {
            Sort: 'Name'
        };
    } else if (queryObject.sort === "distance") {
        if (queryObject.lat && queryObject.lon) {
            var lat = parseFloat(queryObject.lat);
            var lon = parseFloat(queryObject.lon);
            if (isNaN(lat) || isNaN(lon))
                return false;
            if (lat < -90.0 || lat > 90.0 || lon < -180.0 || lon > 180.0)
                return false;
            return {
                Sort: 'Distance',
                Lat: queryObject.lat,
                Lon: queryObject.lon
            };
        } else if (queryObject.addr) {
            return {
                Sort: 'Distance',
                Address: queryObject.addr
            };
        } else {
            return {
                Sort: 'Distance'
            };
        }
    } else
        return false;
}

module.exports = router;