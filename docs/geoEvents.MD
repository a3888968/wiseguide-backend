#/api/geoevents Endpoints

##/api/geoevents/entry *(POST)*
This endpoint logs a new entry to a venue
###Privileges required
- None

###Request
####Headers
- Content-Type: "application/json"

####Body
All values must be specified.

```
{
	"DeviceId": [string] unique identifier of device logging the event,
	"VenueId": [string] the ID of the venue being entered,
	"Time": [number] the UNIX timestamp (milliseconds) for the time the venue was entered
}
```

###Responses
####200 (OK)
The log entry was successful.

####400 (Bad request)
There was something wrong with your request. The error will be one of the following:

- wrong\_content\_type: you didn't specify the Content-Type header correctly
- invalid\_json: the request body was not valid JSON
- invalid\_parameters: you're missing one of the required parameters in the request body (or may have specified something extra)
- bad\_device\_id: the string supplied was empty or just whitespace
- bad\_venue\_id: the string supplied was empty or just whitespace
- bad\_time: the number supplied did not represent a valid time 
- time\_unsynced: the time value was too different from the server's own system time (maximum of 3min difference either way)
- venue\_not\_found: the venue ID supplied did not resolve to a venue in the system

```
{
	"Error": [string] the error that caused this response
}
```