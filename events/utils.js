"use strict";

/*
This module contains utility functions for handling event objects
*/

var validator = require('validator');
var moment = require('moment');
var utilsVenues = require('../venues/utils');
var utils = require('../utils/utils');

/*
Strips down an event occurrence object to the object suitable for the
occurrence API response object
Arguments:
- occ = object : the object to strip down
- includeContributor = boolean : whether to include the contributor in the event/venue objects or not
Returns
- occStr = object : stripped down object
*/
function convertToOccurrenceFull(occ, includeContributor) {
    return {
        OccurrenceId: occ.OccurrenceId,
        Start: occ.Start,
        End: occ.End,
        Event: convertToEventBasic(occ.Event, includeContributor),
        Venue: utilsVenues.convertToVenueBasic(occ.Venue, includeContributor),
        Room: occ.Room
    };
}

/*
Strips down an event occurrence object to the object suitable for the
occurrence_in_venue API response object
Arguments:
- occ = object : the object to strip down
Returns
- occStr = object : stripped down object
*/
function convertToOccurrenceInVenue(occ) {
    return {
        OccurrenceId: occ.OccurrenceId,
        Start: occ.Start,
        End: occ.End,
        Event: convertToEventBasic(occ.Event),
        Room: occ.Room
    };
}

/*
Strips down an event occurrence object to the object suitable for the
occurrence_in_event API response object
Arguments:
- occ = object : the object to strip down
Returns
- occStr = object : stripped down object
*/
function convertToOccurrenceInEvent(occ) {
    return {
        OccurrenceId: occ.OccurrenceId,
        Start: occ.Start,
        End: occ.End,
        Venue: utilsVenues.convertToVenueBasic(occ.Venue),
        Room: occ.Room
    };
}

/*
Strips down an event object to the object suitable for the event_basic
API response object
Arguments:
- ev = object : the object to strip down
- includeContributor = boolean : whether to include the contributor in the event/venue objects or not
Returns
- evBasic = object : stripped down object
*/
function convertToEventBasic(ev, includeContributor) {
    var cats = [];
    if (ev.Categories) cats = ev.Categories;
    return {
        EventId: ev.EventId,
        Name: ev.Name,
        Categories: cats,
        Description: ev.Description,
        Contributor: includeContributor ? ev.Contributor : undefined
    };
}

/*
Strips down an event object to the object suitable for the event API response object
Arguments:
- ev = object : the object to strip down
- includeContributor = boolean : whether to include the contributor in the event/venue objects or not
Returns
- evFull = object : stripped down object
*/
function convertToEventFull(ev, includeContributor) {
    var cats = [];
    if (ev.Categories) cats = ev.Categories;
    var evFull = {
        EventId: ev.EventId,
        Name: ev.Name,
        Categories: cats,
        Description: ev.Description,
        Contributor: includeContributor ? ev.Contributor : undefined,
        EventOccurrences: ev.EventOccurrences
    };
    for (var i = 0; i < evFull.EventOccurrences.length; i++) {
        evFull.EventOccurrences[i] = convertToOccurrenceInEvent(evFull.EventOccurrences[i]);
    }
    return evFull;
}

/*
Validates the properties of a event object.
Arguments:
- theEvent = object : the object to validate
- requireFields = boolean : set to true to require all properties to be 
							present, false to allow some to be missing
Returns:
null if valid, or a string describing the validation error if invalid
*/
function validateEventProperties(theEvent, requireFields) {
    for (var prop in theEvent) {
        if (typeof theEvent[prop] === 'string')
            theEvent[prop] = theEvent[prop].trim();
    }

    if ((theEvent.hasOwnProperty('Name') || requireFields) &&
        !(typeof theEvent.Name === "string" &&
            theEvent.Name.length >= 3 &&
            theEvent.Name.length <= 30))
        return "bad_name";

    if ((theEvent.hasOwnProperty('Description') || requireFields) &&
        !(typeof theEvent.Description === "string" &&
            theEvent.Description.length > 0 &&
            theEvent.Description.length <= 3000))
        return "bad_description";

    if ((theEvent.hasOwnProperty('Categories') || requireFields) &&
        !(utils.isArrayOfStrings(theEvent.Categories)))
        return "bad_categories";

    if ((theEvent.hasOwnProperty('Occurrences') || requireFields) &&
        !(Array.isArray(theEvent.Occurrences) &&
            theEvent.Occurrences.length > 0))
        return "bad_occurrences";

    if (theEvent.hasOwnProperty('Occurrences') || requireFields) {
        if (!theEvent.Occurrences.every(function(occurrence) {
            return (
                typeof occurrence === "object" &&
                occurrence.hasKeys(['Start', 'End', 'VenueId', 'Room']) &&
                typeof occurrence.Start === "number" &&
                typeof occurrence.End === "number" &&
                typeof occurrence.VenueId === "string" &&
                typeof occurrence.Room === "string" &&
                moment(occurrence.Start).isBefore(occurrence.End));
        })) return 'bad_occurrences';
    }
}

exports.convertToOccurrenceFull = convertToOccurrenceFull;
exports.convertToOccurrenceInVenue = convertToOccurrenceInVenue;
exports.convertToOccurrenceInEvent = convertToOccurrenceInEvent;
exports.convertToEventBasic = convertToEventBasic;
exports.convertToEventFull = convertToEventFull;
exports.validateEventProperties = validateEventProperties;