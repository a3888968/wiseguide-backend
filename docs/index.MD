#API Documentation

##Introduction

This folder contains descriptions of each API endpoint and the format of the requests they expect and the responses they give back. To find documentation for endpoints that start /api/[SOME GROUP], look at the file [SOME GROUP].md


##JSON Object Definitions

###user

This object is used to represent a user's details when it is not appropriate to expose any private information such as email address.

```
{
	"Username": [string] username,
	"Name": [string] name,
	"Biography": [string] biography,
	"Summary": [string] summary of the user's responsibilities or contributions,
	"Role": [array[string]] a list of the roles the user has
}
```

###private\_user

This object is used to represent a user's details when it is appropriate to expose more private information such as email address.

```
{
	"Username": [string] username,
	"Email": [string] email address,
	"Name": [string] name,
	"Biography": [string] biography,
	"Summary": [string] summary of the user's responsibilities or contributions,
	"Role": [array[string]] a list of the roles the user has
}
```

###event

This object is used to represent full details about an event.

```
{
	"EventId": [string] event ID,
	"Name": [string] event name,
	"Categories": [array[string]] list of categories applicable to this event,
	"Description": [string] event description,
	"EventOccurrences": [array[occurrence\_in\_event]] a list of occurrences of this event,
	"Contributor": [string] the username of the user who owns the event *only included if the original request was authenticated*
}
```

###event\_basic

This object is used to represent limited details about an event, but omits details about occurrences of the event (usually because the object is a child of an occurrence object itself).

```
{
	"EventId": [string] event ID,
	"Name": [string] event name,
	"Categories": [array[string]] list of categories applicable to this event,
	"Description": [string] event description,
	"Contributor": [string] the username of the user who owns the event *only included if the original request was authenticated*
}
```

###event\_analysis
This object is used to represent limited details about a popular event and is usually used by the `events/analysis` endpoint.

```
{
	"EventId": [string] event ID,
	"Name": [string] event name,
	"Total": [number] total number of potential visits for this event,
	"TimeCounts": [array[time_count]] array of time_count objects, sorted by the Time property
}
```

###venue

This object is used to represent full details about a venue and its location, as well as events happening at the venue.

```
{
	"VenueId": [string] venue ID,
	"Name": [string] venue name,
	"Description": [string] venue description,
	"Lat": [float] the latitude of the venue's geocoordinate,
	"Lon": [float] the longitude of the venue's geocoordinate,
	"Address": human readable address,
	"Rooms": [array[string]] list of rooms in this venue,
	"EventOccurrences": [array[occurrence\_in\_venue]] list of occurrences of events at this venue, sorted in ascending order of start time,
	"Contributor": [string] the username of the user who owns the event *only included if the original request was authenticated*
}
```

###venue\_basic

This object is used to represent limited details about a venue and its location, omitting information about events occurring there. Usually used in lists of venues or when the object is the child of another object.

```
{
	"VenueId": [string] venue ID,
	"Name": [string] venue name,
	"Description": [string] venue description,
	"Lat": [float] the latitude of the venue's geocoordinate,
	"Lon": [float] the longitude of the venue's geocoordinate,
	"Address": human readable address,
	"Rooms": [array[string]] list of rooms in this venue,
	"Contributor": [string] the username of the user who owns the event *only included if the original request was authenticated*
}
```

###venue\_analysis
This object is used to represent limited details about a popular venue and is usually used by the `venues/analysis` endpoint.

```
{
	"VenueId": [string] venue ID,
	"Name": [string] venue name,
	"Lat": [float] the latitude of the venue's geocoordinate,
	"Lon": [float] the longitude of the venue's geocoordinate,
	"Total": [number] total number of visits for this venue,
	"TimeCounts": [array[time_count]] array of time_count objects, sorted by the Time property
}
```

###occurrence

This object is used to represent full details about one occurrence of an event, including start and end times, the details about the event itself, and the venue this occurrence will take place at.

```
{
	"OccurrenceId": [string] ID of event occurrence,
	"Start": [int] start date/time (UNIX timestamp),
	"End": [int] end date/time (UNIX timestamp),
	"Event": [event\_basic] the event that this is an occurrence of,
	"Venue": [venue\_basic] the venue where this occurrence will take place,
	"Room": [string] the name of the room this event will occur in
	"IsCancelled": [boolean] set to true if this event occurrence has been deleted [only used by the api/details/:agendaId endpoint]
}
```

###occurrence\_in\_event

This object is used to represent details about one occurrence of an event, including start and end times and the venue this occurrence will take place at. Details about the parent event are omitted as this object will always be a child of an event object anyway.

```
{
	"OccurrenceId": [string] ID of event occurrence,
	"Start": [int] start date/time (UNIX timestamp),
	"End": [int] end date/time (UNIX timestamp),
	"Venue": [venue\_basic] the venue where this occurrence will take place,
	"Room": [string] the name of the room this event will occur in
}
```

###occurrence\_in\_venue

This object is used to represent details about one occurrence of an event, including start and end times and the details about the event itself. Details about the venue are omitted as this object will always be a child of a venue object anyway.

```
{
	"OccurrenceId": [string] ID of event occurrence,
	"Start": [int] start date/time (UNIX timestamp),
	"End": [int] end date/time (UNIX timestamp),
	"Event": [event\_basic] the event that this is an occurrence of,
	"Room": [string] the name of the room this event will occur in
}
```

###time\_count

This object is used to represent the number of people that have visited a venue or event during a time period starting at `Time`. Period duration is implicitly 30 minutes. Usually used by the `venues/analysis` and `events/analysis` endpoints.

```
{
	"Time": [number] the UNIX timestamp (milliseconds) for the start time of this time chunk,
	"Count": [number] number of visits during this time chunk
}
```


##Authorization header
Every request requires the Authorization header. You should specify in each request one of the following for the Authroization header:
- "SysId [system id]" -  specify the [system id] the request pertains to. Use if the request doesn't require any authorisation/privileges.
- "JWT [JSON web token]": specify a login [JSON web token]  (returned by /api/users/login or /api/users/signup). You can give this for any request as it also encodes the system ID, but you MUST give it for request that require specific privileges or authorisation.

If you do not specify either of the above for the Authorization, then the response to your request for *any* endpoint will be:

```
Response code: 400
Body: {"Error": "no_systemid_or_access_token"}
```

If you specify a SysId value but the system ID supplied is invalid, then the response to your request will be:

```
Response code: 400
Body: {"Error": "bad_systemid"}
```

If you specify a JWT value but it is invalid or expired, then the response to your request will be:

```
Response code: 401
Body: {"Error": "invalid_or_expired_token"}
```

If you specify SysId but the request requires authorisation (and hence JWT should have been specified), then the response to your request will be:

```
Response code: 401
Body: {"Error": "require_access_token"}
```

If you specify JWT but the user account does not match the privilege level specified for that request, then the response to your request will be:

```
Response code: 401
Body: {"Error": "not_permitted"}
```

It is possible for admin users to lock down a system to prevent further changes to data. When this happens, only admin users can carry out certain operations which change data in the system. Operations which fail when a system is locked are marked as such in the *Privileges required* section of each endpoint's documentation. If a non-admin user attempts to carry out one of these operations when the system is locked, then the response to the request will be:

```
Response code: 401
Body: {"Error": "system_locked"}
```


##Creating a new system and deploying the web frontend

For now, fire a `multipart/form-data` POST request of the following format to ```/admin/systems/create/<systemId>```:

```
logoImg = <desired logo image>
headerImg = <desired header image>
data = {
	"Center": { "Lat": 0, "Lon": 0 }, // rough co-ordinates of center of festival area
	"AppendToLocationQuery: "Bristol UK", // name of region to append to reverse geo-coding queries
	"User": { // account details for the admin user of this system
		"Username: 'admin',
		"Email: 'someadminemailaddress@notarealdomain.xyz',
		"Password: 'l0ngP4ssw0rd',
		"Name: 'The Administrator',
		"Biography: 'Some biography',
		"Summary: 'Some summary'
	},
	"Config": { // config options for the frontend
         title: 'Website Title',
         backgroundColor: 'rgb(R, G, B)',
         foregroundColor: 'rgb(R, G, B)',
         homePageBodyHtml: '<h1>some heading</h1><p>A paragraph</p>' // HTML body of the home page
    }
}
```