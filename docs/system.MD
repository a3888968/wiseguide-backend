#/api/system Endpoints


##/api/system/lock *(POST)*

Calling this endpoint will lock the system, preventing further creation, editing and deleting of events, occurrences and venues until the system is unlocked again. Only admin users can still perform these prohibited actions when the system is locked.

###Privileges required
- A user with the "admin" role.

###Responses

####200 (OK)
The system was locked successfully (or it was already locked).


##/api/system/unlock *(POST)*

Calling this endpoint will unlock the system, re-allowing creation, editing and deleting of events, occurrences and venues for all contributors.

###Privileges required
- A user with the "admin" role.

###Responses

####200 (OK)
The system was unlocked successfully (or it was already unlocked).


##/api/system/islocked *(GET)*
This endpoint will return a status code indicating whether the system is locked.

###Privileges required
- A logged-in user.

###Responses

####200 (OK)
The system is unlocked.

####423 (Locked)
The system is locked.