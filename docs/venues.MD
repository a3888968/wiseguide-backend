#/api/venues Endpoints


##/api/venues/create *(POST)*

This endpoint allows the creation of a new venue.

###Privileges required
- A user with the "contributor" role
- If system is locked, user also needs "admin" role

###Request

####Headers
- Content-Type: "application/json"

####Body

All values must be supplied.

```
{
	"Name": [string] venue name (3-30 chars),
	"Description": [string] venue description (1-3000 chars),
	"Lat": [float] latitude (>=-90.0 and <=+90.0),
	"Lon": [float] longitude (>=-180.0 and <=+180.0),
	"Address": [string] human readable address (1-100 chars),
	"Rooms": [array[string]] list of room names (1-40 chars each, all unique for venue, at least one specified)
}
```

###Responses

####200 (OK)
The venue was created successfully and a venue ID was generated.

```
{
	"VenueId": [string] the unique ID for this venue
}
```

####400 (Bad request)
There was something wrong with your request. The error will be one of the following:

- wrong\_content\_type: you didn't specify the Content-Type header correctly
- invalid\_json: the request body was not valid JSON
- invalid\_parameters: you're missing one of the required parameters in the request body (or may have specified something extra)
- bad\_name: the name you supplied was invalid
- bad\_description: the description you supplied was invalid
- bad\_lat: the latitude you supplied was invalid
- bad\_lon: the longitude you supplied was invalid
- bad\_address: the address you supplied was invalid
- bad\_rooms: the rooms value you supplied was invalid or one of the individual rooms were invalid

```
{
	"Error": [string] the error that caused this response
}
```






##/api/venues/edit/[venueid] *(POST)*

This endpoint allows the editing of the details of the venue with ID [venueid]. Note that rooms cannot be edited through this endpoint - use ```/api/venues/addroom``` and ```/api/venues/deleteroom``` instead.

###Privileges required
- A user with the "contributor" role

If the preceding condition is not met, a 401 "not\_permitted" response is returned. In addition, at least one of the following two conditions must be met:

- The user also has the "admin" role
- The user originally created the venue being edited

If neither of these two conditions are met, then the 400 "condition\_violated" response is returned (see below).

- If system is locked, user must have "admin" role


###Request

####Headers
- Content-Type: "application/json"

####Body

Only values that need to be changed should be specified.

```
{
	"Name": [string] venue name (3-30 chars),
	"Description": [string] venue description (1-3000 chars),
	"Lat": [float] latitude (>=-90.0 and <=+90.0),
	"Lon": [float] longitude (>=-180.0 and <=+180.0),
	"Address": [string] human readable address (1-100 chars)
}
```

###Responses

####200 (OK)
The venue was edited successfully.

####400 (Bad request)
There was something wrong with your request. The error will be one of the following:

- wrong\_content\_type: you didn't specify the Content-Type header correctly
- invalid\_json: the request body was not valid JSON
- invalid\_parameters: you're missing one of the required parameters in the request body (or may have specified something extra)
- bad\_name: the name you supplied was invalid
- bad\_description: the description you supplied was invalid
- bad\_lat: the latitude you supplied was invalid
- bad\_lon: the longitude you supplied was invalid
- bad\_address: the address you supplied was invalid
- condition\_violated: one of the conditions that needed to be true to make this edit were in fact not true. This could be any of the following:
	- this venue ID was not found
	- you are not allowed to edit this venue because you are not an admin, nor are you the original contributor who created this venue 

```
{
	"Error": [string] the error that caused this response
}
```






##/api/venues/addroom/[venueid] *(POST)*

This endpoint allows you to add a new room to the venue with ID [venueid].

###Privileges required
- A user with the "contributor" role

If the preceding condition is not met, a 401 "not\_permitted" response is returned. In addition, at least one of the following two conditions must be met:

- The user also has the "admin" role
- The user originally created the venue being edited

If neither of these two conditions are met, then the 400 "condition\_violated" response is returned (see below).

- If system is locked, user must have "admin" role


###Request

####Headers
- Content-Type: "application/json"

####Body

```
{
	"Name": [string] new room's name (1-40 chars, unique for this venue)
}
```

###Responses

####200 (OK)
The room was added successfully or the room already existed.

####400 (Bad request)
There was something wrong with your request. The error will be one of the following:

- wrong\_content\_type: you didn't specify the Content-Type header correctly
- invalid\_json: the request body was not valid JSON
- invalid\_parameters: you're missing one of the required parameters in the request body (or may have specified something extra)
- bad\_name: the name you supplied was invalid 
- condition\_violated: one of the conditions that needed to be true to make this edit were in fact not true. This could be any of the following:
	- this venue ID was not found
	- you are not allowed to edit this venue because you are not an admin, nor are you the original contributor who created this venue 
```
{
	"Error": [string] the error that caused this response
}
```






##/api/venues/deleteroom/[venueid] *(POST)*

This endpoint allows you to delete a room from the venue with ID [venueid] (as long as it is not the only room left).

###Privileges required
- A user with the "contributor" role

If the preceding condition is not met, a 401 "not\_permitted" response is returned. In addition, at least one of the following two conditions must be met:

- The user also has the "admin" role
- The user originally created the venue being edited

If neither of these two conditions are met, then the 400 "condition\_violated" response is returned (see below).

- If system is locked, user must have "admin" role


###Request

####Headers
- Content-Type: "application/json"

####Body

```
{
	"Name": [string] name of the room to be deleted
}
```

###Responses

####200 (OK)
The room was deleted successfully.

####400 (Bad request)
There was something wrong with your request. The error will be one of the following:

- wrong\_content\_type: you didn't specify the Content-Type header correctly
- invalid\_json: the request body was not valid JSON
- invalid\_parameters: you're missing one of the required parameters in the request body (or may have specified something extra)
- bad\_name: the name you supplied was invalid 
- room\_has\_events: you are trying to delete a room which has events assigned to it. This is not permitted.
- condition\_violated: one of the conditions that needed to be true to make this edit were in fact not true. This could be any of the following:
	- this venue ID was not found
	- you are not allowed to edit this venue because you are not an admin, nor are you the original contributor who created this venue 
	- you tried to delete the only room left in the venue

```
{
	"Error": [string] the error that caused this response
}
```







##/api/venues/delete/[venueid] *(POST)*

This endpoint allows you to delete the venue with ID [venueid].

###Privileges required
- A user with the "contributor" role

If the preceding condition is not met, a 401 "not\_permitted" response is returned. In addition, at least one of the following two conditions must be met:

- The user also has the "admin" role
- The user originally created the venue being edited

If neither of these two conditions are met, then the 400 "condition\_violated" response is returned (see below).

- If system is locked, user must have "admin" role

###Responses

####200 (OK)
The venue was deleted successfully.

####400 (Bad request)
There was something wrong with your request. The error will be one of the following:

- venue\_has\_events: you are trying to delete a venue which has events assigned to it. This is not permitted.
- condition\_violated: one of the conditions that needed to be true to make this edit were in fact not true. This could be any of the following:
	- this venue ID was not found
	- you are not allowed to edit this venue because you are not an admin, nor are you the original contributor who created this venue 

```
{
	"Error": [string] the error that caused this response
}
```







##/api/venues/details/[venueid] *(GET)*

This endpoint allows you to get the full details of the venue with ID [venueid], including its rooms and event occurrences at this venue.

###Privileges required
- None

###Responses

####200 (OK)
```
[venue] object containing details of the venue
```

####404 (Not found)
We couldn't find what you asked for. The error will be one of the following:

- venue\_not\_found: the venue ID specified does not exist.

```
{
	"Error": [string] the error that caused this response
}
```









##/api/venues/all *(GET)*

This endpoint allows you to get a list of all events in the system. The response is **not** paginated, but is sorted by distance from the center of the bounding box of all of the venues.

###Privileges required
- None

###Responses

####200 (OK)
```
{
	"Venues": [array[venue_basic]] list of all venues in system (no guaranteed sort order),
	"Center": { Lat: [float], Lon: [float] } the co-ordinates of the center of the bounding box
}
```









##/api/venues/near/[query] *(GET)*

This endpoint allows you to get a list of all events in the system, sorted by their distance from a given location: [query]. The system will look-up your [query] using a location service and get the geocoordinates of the top result, then sort by ascending distance from that point. The response is **not** paginated.

###Privileges required
- None

###Responses

####200 (OK)
```
{
	"Venues": [array[venue_basic]] list of all venues in system (sorted by distance from the top result for your location query),
	"LookedUpLocation": { Lat: [float], Lon: [float] } the latitude and longitude that venues are sorted by distance from
}
```










##/api/venues/near/[lat]/[lon] *(GET)*

This endpoint allows you to get a list of all events in the system, sorted by their distance from a given geocoordinate: ([lat],[lon]). The response is **not** paginated.

###Privileges required
- None

###Responses

####200 (OK)
```
{
	"Venues": [array[venue_basic]] list of all venues in system (sorted by distance from the given point),
	"LookedUpLocation": { Lat: [float], Lon: [float] } the latitude and longitude that venues are sorted by distance from
}
```










##/api/venues/by/[contributor] *(GET)*

This endpoint allows authenticated users to get a list of venues added by [contributor].

###Privileges required
- Must be logged in

###Responses

####200 (OK)
```
{
	"Venues": [array[venue_basic]] list of venues created by specified contributor
}
```
##/api/venues/analytics *(GET)*
This endpoint allows admin users to get a list of the most popular venues (at most 5).
###Privileges required
- A user with the "admin" role.

###Responses
####200 (OK)
```
{
	"Venues": [array[venue_analysis]] list of venue_analysis objects, sorted by the total number of visits
}
```
