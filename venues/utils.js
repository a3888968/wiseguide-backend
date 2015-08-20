"use strict";

/*
This module contains utility functions for handling venue objects
*/

var validator = require('validator');
var utils = require('../utils/utils');
var utilsEvents = require('../events/utils');

/*
Strips down a venue object to the object suitable for the venue_basic API response
Arguments:
- venue = object : the object to strip down
- includeContributor = boolean : whether to include the contributor in the event/venue objects or not
Returns
- venueBasic = object : stripped down object
*/
function convertToVenueBasic(venue, includeContributor) {
    return {
        VenueId: venue.VenueId,
        Name: venue.Name,
        Description: venue.Description,
        Lat: venue.Lat,
        Lon: venue.Lon,
        Address: venue.Address,
        Rooms: venue.Rooms,
        Contributor: includeContributor ? venue.Contributor : undefined
    };
}

/*
Strips down a venue object to the object suitable for the venue API response
Arguments:
- venue = object : the object to strip down
- includeContributor = boolean : whether to include the contributor in the event/venue objects or not
Returns
- venueFull = object : stripped down object
*/
function convertToVenueFull(venue, includeContributor) {
    var venueFull = {
        VenueId: venue.VenueId,
        Name: venue.Name,
        Description: venue.Description,
        Lat: venue.Lat,
        Lon: venue.Lon,
        Address: venue.Address,
        Rooms: venue.Rooms,
        EventOccurrences: venue.EventOccurrences,
        Contributor: includeContributor ? venue.Contributor : undefined
    };
    for (var i = 0; i < venueFull.EventOccurrences.length; i++) {
        venueFull.EventOccurrences[i] = utilsEvents.convertToOccurrenceInVenue(venueFull.EventOccurrences[i]);
    }
    return venueFull;
}

/*
Validates the properties of a venue object.
Arguments:
- venue = object : the object to validate
- requireFields = boolean : set to true to require all properties to be 
							present, false to allow some to be missing
Returns:
null if valid, or a string describing the validation error if invalid
*/
function validateVenueProperties(venue, requireFields) {
    for (var prop in venue) {
        if (typeof venue[prop] === 'string')
            venue[prop] = venue[prop].trim();
    }

    if ((venue.hasOwnProperty('Name') || requireFields) &&
        !(typeof venue.Name === "string" &&
            venue.Name.length >= 3 &&
            venue.Name.length <= 30))
        return "bad_name";

    if ((venue.hasOwnProperty('Description') || requireFields) &&
        !(typeof venue.Description === "string" &&
            venue.Description.length >= 1 &&
            venue.Description.length <= 3000))
        return "bad_description";

    if ((venue.hasOwnProperty('Address') || requireFields) &&
        !(typeof venue.Address === "string" &&
            venue.Address.length >= 1 &&
            venue.Address.length <= 100))
        return "bad_address";

    if ((venue.hasOwnProperty('Lat') || requireFields) &&
        !(typeof venue.Lat === "number" &&
            venue.Lat >= -90.0 &&
            venue.Lat <= 90.0))
        return "bad_lat";

    if ((venue.hasOwnProperty('Lon') || requireFields) &&
        !(typeof venue.Lon === "number" &&
            venue.Lon >= -180.0 &&
            venue.Lon <= 180.0))
        return "bad_lon";

    if (venue.hasOwnProperty('Rooms') || requireFields) {
        if (!Array.isArray(venue.Rooms))
            return "bad_rooms";
        else if (venue.Rooms < 1)
            return "bad_rooms";
        else if (utils.stringArrayHasDuplicates(venue.Rooms))
            return "bad_rooms";
        else {
            for (var i = 0; i < venue.Rooms.length; i++) {
                if (typeof venue.Rooms[i] !== "string")
                    return "bad_rooms";
                else if (venue.Rooms[i].length < 1)
                    return "bad_rooms";
                else if (venue.Rooms[i].length > 40)
                    return "bad_rooms";
            }
        }
    }
}


exports.convertToVenueBasic = convertToVenueBasic;
exports.convertToVenueFull = convertToVenueFull;
exports.validateVenueProperties = validateVenueProperties;