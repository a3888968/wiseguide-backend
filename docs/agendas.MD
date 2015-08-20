#/api/agendas Endpoints

##/api/agendas/add *(POST)*
This endpoint allows to add an event occurrence with ID `OccurrenceId` to a user's agenda (already existing or new).
###Privileges required
- None

###Request
####Headers
- Content-Type: "application/json"

####Body
- `OccurrenceId` must be supplied.
- Only supply `AgendaId` if adding to an existing agenda. Do not supply to receive a generated `AgendaId` (e.g. creating an agenda for the first time).

```
{
	"AgendaId": [string] the ID of an existing agenda,
	"OccurrenceId": [string] the ID of an existing event occurrence
}
```

###Responses
####200 (OK)
- `AgendaId` will only be returned for a newly created agenda.

```
{
	"AgendaId": [string] the ID of a newly created agenda
}
```
####400 (Bad request)
There was something wrong with your request. The error will be one of the following:

- wrong\_content\_type: you didn't specify the Content-Type header correctly
- invalid\_json: the request body was not valid JSON
- invalid\_parameters: you're missing one of the required parameters in the request body (or may have specified something extra)
- bad\_agenda\_id: the supplied `AgendaId` is not a non-empty string (after trimming)
- agenda\_not\_found: the agenda ID specified does not exist
- bad\_occurrence\_id: the supplied `OccurrenceId` is not a non-empty string (after trimming)
- occurrence\_not\_found: the occurrence ID specified does not exist
- condition\_violated: one of the conditions that needed to be true to add this event occurrence to the agenda were in fact not true. This could be any of the following:
	- occurrence already added to the agenda

```
{
	"Error": [string] the error that caused this response
}
```
##/api/agendas/details/[agendaid] *(GET)*
This endpoint allows you to get a list of all event occurrences for the agenda with ID [agendaid], represented by an array of `occurrence` objects.
###Privileges required
- None

###Responses
####200 (OK)
```
{
	"EventOccurrences": [array[occurrence]] list of event occurrences (sorted by start time)
}
```
####404 (Not found)
We couldn't find what you asked for. The error will be one of the following:

- agenda\_not\_found: the agenda ID specified does not exist.

```
{
	"Error": [string] the error that caused this response
}
```



##/api/agendas/suggested/[agendaId] *(GET)*

This endpoint gets a list of suggested events that users with similar agendas are going to.

###Privileges required
- None

###Responses

####200 (OK)
```
{
	"Events": [array[event_basic]] list of suggested events
}
```

##/api/agendas/remove *(POST)*
This endpoint allows you to remove the event occurrence with ID `OccurrenceId` from the agenda with ID `AgendaId`.
###Privileges required
- None

###Request

####Headers
- Content-Type: "application/json"

####Body
All values must be supplied.

```
{
	"AgendaId": [string] the ID of an existing agenda,
	"OccurrenceId": [string] the ID of the event occurrence to be removed
}
```
###Responses
####200 (OK)
The event occurrence was removed succesfully.
####400 (Bad request)
There was something wrong with your request. The error will be one of the following:

- wrong\_content\_type: you didn't specify the Content-Type header correctly
- invalid\_json: the request body was not valid JSON
- invalid\_parameters: you're missing one of the required parameters in the request body (or may have specified something extra)
- bad\_agenda\_id: the supplied `AgendaId` is not a non-empty string (after trimming)
- bad\_occurrence\_id: the supplied `OccurrenceId` is not a non-empty string (after trimming)
- condition\_violated: one of the conditions that needed to be true to remove this event occurrence from the agenda were in fact not true. This could be any of the following:
	- there was no database entry for the specified `AgendaId` and `OccurrenceId` (may also happen if the entry is already deleted)

```
{
	"Error": [string] the error that caused this response
}
```
