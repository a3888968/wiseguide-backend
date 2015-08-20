#/api/events Endpoints


##/api/events/create *(POST)*

This endpoint allows the creation of a new event. Events consist of several occurrences, and an event may not exist without at least one occurrence, which must be specified when you create the event through this endpoint.

###Privileges required
- A user with the "contributor" role
- If system is locked, user also needs "admin" role

###Request

####Headers
- Content-Type: "application/json"

####Body

All values must be supplied. Notes:

- ```Categories``` can be an empty array (but you must explicitly supply an empty array of the form ```[]``` if this is the case)
- ```Occurrences``` cannot be empty - you must be supply at least one value. Notes:
	- All values must be supplied in each occurrence object.
	- The ```Start``` time must be less than or equal to the ```End``` time.
	- The ```VenueId``` must be the ID of an actual venue.
	- The ```Room``` must be one of the rooms of the given venue.

```
{
	"Name": [string] event name (3-30 chars),
	"Categories": [array[string]] list of categories (an empty list can be specified),
	"Description": [string] event description (1-3000 chars),
	"Occurrences": [array[{ 
			"Start": [int] start date/time (represented as UNIX timestamp),
			"End": [int] end date/time (represented as UNIX timestamp),
			"VenueId": [string] venue ID,
			"Room": [string] name of room
	}]]
}
```

###Responses

####200 (OK)
The event and its occurrence(s) were created successfully and an event ID was generated.

```
{
	"EventId": [string] the unique ID for this event
}
```

####400 (Bad request)
There was something wrong with your request. The error will be one of the following:

- wrong\_content\_type: you didn't specify the Content-Type header correctly
- invalid\_json: the request body was not valid JSON
- invalid\_parameters: you're missing one of the required parameters in the request body (or may have specified something extra)
- bad\_name: the name you supplied was invalid
- bad\_categories: you specified one or more categories that do not exist or you specified an invalid value
- bad\_description: you specified an invalid description
- bad\_occurrences: you specified an invalid value for occurrences, or one of the occurrences supplied was invalid, perhaps because it was missing a parameter or the start time was after the end time
- bad\_venue: the venue specified on one or more of your occurrences does not exist
- bad\_room: the room specified on one or more of your occurrences is not a room in the venue you selected for that occurrence

```
{
	"Error": [string] the error that caused this response
}
```



##/api/events/edit/[eventid] *(POST)*

This endpoint allows the editing of the details of the event with ID [eventid]. Note that it does **not** allow the editing of the start/end times, venues, or other details which are specific to an *occurrence* of an event - you should use ```/api/events/editoccurrence/[occurrenceid]``` instead.

###Privileges required
- A user with the "contributor" role

If the preceding condition is not met, a 401 "not\_permitted" response is returned. In addition, at least one of the following two conditions must be met:

- The user also has the "admin" role
- The user originally created the event being edited

If neither of these two conditions are met, then the 400 "condition\_violated" response is returned (see below).

- If system is locked, user must have "admin" role

###Request

####Headers
- Content-Type: "application/json"

####Body

You should only specify the values that you need to change. Notes:

- ```Categories``` can be an empty array (but you must be explicitly supply an empty array of the form ```[]``` if this is the case).
- Specifying ```Categories``` will overwrite the entire existing list of categories for this event. Therefore, if you want to add a category, you must specify all of the current categories, plus the new one, and if you want to remove a category, you must specify all of the current categories bar the one you want to remove.

```
{
	"Name": [string] event name (3-30 chars),
	"Categories": [array[string]] list of categories (an empty list can be specified),
	"Description": [string] event description (1-3000 chars)
}
```

###Responses

####200 (OK)
The event was edited successfully.

####400 (Bad request)
There was something wrong with your request. The error will be one of the following:

- wrong\_content\_type: you didn't specify the Content-Type header correctly
- invalid\_json: the request body was not valid JSON
- invalid\_parameters: you're missing one of the required parameters in the request body (or may have specified something extra)
- bad\_name: the name you supplied was invalid
- bad\_categories: you specified one or more categories that do not exist or you specified an invalid value
- bad\_description: you specified an invalid description
- condition\_violated: one of the conditions that needed to be true to make this edit were in fact not true. This could be any of the following:
	- an event occurrence wasn't found for this event ID
	- you are not allowed to edit this event because you are not an admin, nor are you the original contributor who created this event 

```
{
	"Error": [string] the error that caused this response
}
```






##/api/events/delete/[eventid] *(POST)*

This endpoint allows the deletion of the details of the event with ID [eventid], as well as any occurrences of that event.

###Privileges required
- A user with the "contributor" role

If the preceding condition is not met, a 401 "not\_permitted" response is returned. In addition, at least one of the following two conditions must be met:

- The user also has the "admin" role
- The user originally created the event being edited

If neither of these two conditions are met, then the 400 "condition\_violated" response is returned (see below).

- If system is locked, user must have "admin" role

###Responses

####200 (OK)
The event was deleted successfully.

####400 (Bad request)
There was something wrong with your request. The error will be one of the following:

- condition\_violated: one of the conditions that needed to be true to make this edit were in fact not true. This could be any of the following:
	- an event occurrence wasn't found for this event ID
	- you are not allowed to edit this event because you are not an admin, nor are you the original contributor who created this event 

```
{
	"Error": [string] the error that caused this response
}
```






##/api/events/createoccurrence/[eventid] *(POST)*

This endpoint allows the creation of a new occurence of the event with ID [eventid].

###Privileges required
- A user with the "contributor" role

If the preceding condition is not met, a 401 "not\_permitted" response is returned. In addition, at least one of the following two conditions must be met:

- The user also has the "admin" role
- The user originally created the event being edited

If neither of these two conditions are met, then the 400 "condition\_violated" response is returned (see below).

- If system is locked, user must have "admin" role

###Request

####Headers
- Content-Type: "application/json"

####Body

All values must be supplied. Notes:

- The ```Start``` time must be less than or equal to the ```End``` time.
- The ```VenueId``` must be the ID of an actual venue.
- The ```Room``` must be one of the rooms of the given venue.

```
{
	"Start": [int] start date/time (represented as UNIX timestamp),
	"End": [int] end date/time (represented as UNIX timestamp),
	"VenueId": [string] venue ID,
	"Room": [string] name of room
}
```

###Responses

####200 (OK)
The occurrence was created successfully.

```
{
	"OccurrenceId": [string] the unique ID of the new event occurrence
}
```

####400 (Bad request)
There was something wrong with your request. The error will be one of the following:

- wrong\_content\_type: you didn't specify the Content-Type header correctly
- invalid\_json: the request body was not valid JSON
- invalid\_parameters: you're missing one of the required parameters in the request body (or may have specified something extra)
- bad\_start\_end: there's something wrong with your start and end date/times (possibly your start time is after your end time)
- bad\_venue: the venue specified does not exist
- bad\_room: the room specified is not a room in the venue you selected
- condition\_violated: one of the conditions that needed to be true to make this edit were in fact not true. This could be any of the following:
	- the event ID specified does not exist
	- you are not allowed to add occurrences to this event because you are not an admin, nor are you the original contributor who created this event 

```
{
	"Error": [string] the error that caused this response
}
```






##/api/events/editoccurrence/[occurrenceid] *(POST)*

This endpoint allows the editing of an individual event occurrence with the occurrence ID [occurrenceid].

###Privileges required
- A user with the "contributor" role

If the preceding condition is not met, a 401 "not\_permitted" response is returned. In addition, at least one of the following two conditions must be met:

- The user also has the "admin" role
- The user originally created the event being edited

If neither of these two conditions are met, then the 400 "condition\_violated" response is returned (see below).

- If system is locked, user must have "admin" role

###Request

####Headers
- Content-Type: "application/json"

####Body

Only specify values that need to be changed. Notes:

- The ```Start``` time must be less than or equal to the ```End``` time (if you only specify one or the other, the same relationship must apply between the specified value and the opposing value in the database).
- The ```VenueId``` must be the ID of an actual venue.
- The ```Room``` must be one of the rooms of the given venue.
- If you specify ```VenueId```, then you must also specify ```Room```.

```
{
	"Start": [int] start date/time (represented as UNIX timestamp),
	"End": [int] end date/time (represented as UNIX timestamp),
	"VenueId": [string] venue ID,
	"Room": [string] name of room (must be specified if VenueId is specified)
}
```

###Responses

####200 (OK)
The occurrence was edited successfully.

####400 (Bad request)
There was something wrong with your request. The error will be one of the following:

- bad\_start\_end: you supplied both start and end times, but your start time is after your end time
- cant\_specify\_venue\_without\_room: you specified a venue ID, but not a room. This is not allowed: if you change the venue, you need to update the room as well.
- bad\_venue: the venue specified does not exist
- condition\_violated: one of the conditions that needed to be true to make this edit were in fact not true. This could be any of the following:
	- the occurrence ID specified does not exist
	- you are not allowed to edit occurrences of this event because you are not an admin, nor are you the original contributor who created this event 
	- you specified a new start time but not a new end time, and your new start time is after the existing end time for this occurrence 
	- you specified a new end time but not a new start time, and your new end time is before the existing start time for this occurrence
	- you specified a room that does not exist in the current venue for this event (if you did not specify a new venue) or in the newly specified venue (if you specified a new venue)

```
{
	"Error": [string] the error that caused this response
}
```







##/api/events/deleteoccurrence/[occurrenceid] *(POST)*

This endpoint allows the deletion of an individual event occurrence with the occurrence ID [occurrenceid].

###Privileges required
- A user with the "contributor" role

If the preceding condition is not met, a 401 "not\_permitted" response is returned. In addition, at least one of the following two conditions must be met:

- The user also has the "admin" role
- The user originally created the event being edited

If neither of these two conditions are met, then the 400 "condition\_violated" response is returned (see below).

- If system is locked, user must have "admin" role

###Responses

####200 (OK)
The occurrence was deleted successfully.

####400 (Bad request)
There was something wrong with your request. The error will be one of the following:

- condition\_violated: one of the conditions that needed to be true to make this edit were in fact not true. This could be any of the following:
	- the occurrence ID specified does not exist
	- you are not allowed to delete occurrences of this event because you are not an admin, nor are you the original contributor who created this event 

```
{
	"Error": [string] the error that caused this response
}
```







##/api/events/details/[eventid] *(GET)*

This endpoint allows you to get the full details of the event with ID [eventid], including all of its occurrences and the details of the venues of those event occurrences.

###Privileges required
- None

###Responses

####200 (OK)
```
[event] object containing details of the event
```

####404 (Not found)
We couldn't find what you asked for. The error will be one of the following:

- event\_not\_found: the event ID you provided couldn't be found.

```
{
	"Error": [string] the error that caused this response
}
```








##/api/events/all + /api/events/all/[nexttoken] *(GET)*

This endpoint allows you to get a list of all event occurrences in the system. The response is paginated. You may specify a query string which will filter and sort results for you.

###Privileges required
- None

###Request

####Query string
You can append one of the following query strings to the end of the URL to filter or sort the results that the API returns:

- No query string
	- sort by start date/time (ascending order)
- ```?sort=start``` 
	- sort by start date/time (ascending order)
- ```?sort=start&start=[starttime]``` 
	- sort by start date/time (ascending order) and filter out results before ```[starttime]```
	- replace ```[starttime]``` with a UNIX timestamp
- ```?sort=start&start=[starttime]&end=[endtime]``` 
	- sort by start date/time (ascending order) and filter out results before ```[starttime]``` and after ```[endtime]```
	- replace ```[starttime]``` and ```[endtime]``` with UNIX timestamps
- ```?sort=name``` 
	- sort by name of event (ascending order)

###Responses

####200 (OK)
```
{
	"EventOccurrences": [array[occurrence]] list of event occurrences (sorted and filtered as specified),
	"NextToken": [string] a key which you can use to get the next page of results - make the same request but with this value set as the [nexttoken] URL parameter
}
```

####400 (Bad request)
There was something wrong with your request. The error will be one of the following:

- bad\_query: the query string you specified was invalid. You can only specify one of the exact combinations above - any variations or additions to these strings will cause this error.

```
{
	"Error": [string] the error that caused this response
}
```









##/api/events/search/[query] + /api/events/search/[query]/[nexttoken] *(GET)*

This endpoint allows you to search for an event occurrences by event name (specifically, it finds any events whose name contains [query] as a substring). The response is paginated. You may specify a query string which will filter and sort results for you.

###Privileges required
- None

###Request

####Query string
You can append one of the following query strings to the end of the URL to filter or sort the results that the API returns:

- No query string
	- sort by start date/time (ascending order)
- ```?sort=start``` 
	- sort by start date/time (ascending order)
- ```?sort=start&start=[starttime]``` 
	- sort by start date/time (ascending order) and filter out results before ```[starttime]```
	- replace ```[starttime]``` with a UNIX timestamp
- ```?sort=start&start=[starttime]&end=[endtime]``` 
	- sort by start date/time (ascending order) and filter out results before ```[starttime]``` and after ```[endtime]```
	- replace ```[starttime]``` and ```[endtime]``` with UNIX timestamps

###Responses

####200 (OK)
```
{
	"EventOccurrences": [array[occurrence]] list of event occurrences (sorted and filtered as specified),
	"NextToken": [string] a key which you can use to get the next page of results - make the same request but with this value set as the [nexttoken] URL parameter. If this isn't set, there are no more pages
}
```

####400 (Bad request)
There was something wrong with your request. The error will be one of the following:

- bad\_query: the query string you specified was invalid. You can only specify one of the exact combinations above - any variations or additions to these strings will cause this error.

```
{
	"Error": [string] the error that caused this response
}
```










##/api/events/category/[categoryname] + /api/events/category/[categoryname]/[nexttoken] *(GET)*

This endpoint allows you to search for event occurrences by category. The response is paginated. You may specify a query string which will filter and sort results for you.

###Privileges required
- None

###Request

####Query string
You can append one of the following query strings to the end of the URL to filter or sort the results that the API returns:

- No query string
	- sort by start date/time (ascending order)
- ```?sort=start``` 
	- sort by start date/time (ascending order)
- ```?sort=start&start=[starttime]``` 
	- sort by start date/time (ascending order) and filter out results before ```[starttime]```
	- replace ```[starttime]``` with a UNIX timestamp
- ```?sort=start&start=[starttime]&end=[endtime]``` 
	- sort by start date/time (ascending order) and filter out results before ```[starttime]``` and after ```[endtime]```
	- replace ```[starttime]``` and ```[endtime]``` with UNIX timestamps
- ```?sort=name``` 
	- sort by name of event (ascending order)

###Responses

####200 (OK)
```
{
	"EventOccurrences": [array[occurrence]] list of event occurrences (sorted and filtered as specified),
	"NextToken": [string] a key which you can use to get the next page of results - make the same request but with this value set as the [nexttoken] URL parameter. If this isn't set, there are no more pages
}
```

####400 (Bad request)
There was something wrong with your request. The error will be one of the following:

- bad\_query: the query string you specified was invalid. You can only specify one of the exact combinations above - any variations or additions to these strings will cause this error.

```
{
	"Error": [string] the error that caused this response
}
```











##/api/events/ongoing/[time] *(GET)*

This endpoint allows you to search for event occurrences which will be ongoing at the specified [time] - that is, their start time is less than or equal to [time], and their end time is greater than or equal to [time]. [time] should be specified as a UNIX timestamp. The response is paginated. You may specify a query string which will filter and sort results for you.

###Privileges required
- None

###Request

####Query string
You can append one of the following query strings to the end of the URL to filter or sort the results that the API returns:

- No query string
	- sort by start date/time (ascending order)
- ```?sort=start``` 
	- sort by start date/time (ascending order)
- ```?sort=name``` 
	- sort by name of event (ascending order)
- ```?sort=distance``` 
	- sort by the distance of the event occurrence's venue from the central point of
	  all venues of ongoing events
- ```?sort=distance&addr=[address]``` 
	- sort by the distance of the event occurrence's venue from a looked-up address
- ```?sort=distance&lat=[latitude]&lon=[longitude]``` 
	- sort by the distance of the event occurrence's venue from a geocoordinate point
	- replace [latitude] with a float representing the latitude of the geocoordinate parameter
	- replace [longitude] with a float representing the longitude of the geocoordinate parameter

###Responses

####200 (OK)
```
{
	"EventOccurrences": [array[occurrence]] list of event occurrences (sorted and filtered as specified),
	"LookedUpLocation": { Lat: [float], Lon: [float] } the latitude and longitude that event occurences are sorted by distance from (ony present for ?sort=distance... queries)
}
```

####400 (Bad request)
There was something wrong with your request. The error will be one of the following:

- bad\_query: the query string you specified was invalid. You can only specify one of the exact combinations above - any variations or additions to these strings will cause this error.

```
{
	"Error": [string] the error that caused this response
}
```











##/api/events/by/[contributor] *(GET)*

This endpoint allows authenticated users to get a list of events added by [contributor].

###Privileges required
- Must be logged in

###Responses

####200 (OK)
```
{
	"Events": [array[event_basic]] list of events created by specified contributor
}
```











##/api/events/suggested/[eventId] *(GET)*

This endpoint gets a list of suggested similar events to the event with the ID [eventId]

###Privileges required
- None

###Responses

####200 (OK)
```
{
	"Events": [array[event_basic]] list of suggested events
}
```

##/api/events/analytics *(GET)*
This endpoint allows admin users to get a list of the most popular events (at most 5).
###Privileges required
- A user with the "admin" role.

###Responses
####200 (OK)
```
{
	"Events": [array[event_analysis]] list of event_analysis objects, sorted by the total number of visits
}
```
