#/api/users Endpoints


##/api/users/login *(POST)*

This endpoint allows you to supply a username/email address of a user account and its password and receive back a login access token which can be attached to further requests to authenticate them.

###Privileges required
- None

###Request

####Headers
- Content-Type: "application/json"

####Body
All values must be supplied.

```
{
	"Username": [string] the username or email address of the account
	"Password": [string] the password of the account
}
```

###Responses

####200 (OK)
The credentials supplied were correct, and a login access token has been generated. It will expire at the date/time indicated. Details about the logged in user are also supplied in the response.

```
{
	"Token": [string] JSON web token,
	"Expires": [int] token expiry (UNIX timestamp),
	"User": [private\_user] object of logged in user
}
```

####400 (Bad request)
There was something wrong with your request. The error will be one of the following:

- wrong\_content\_type: you didn't specify the Content-Type header correctly
- invalid\_json: the request body was not valid JSON
- invalid\_parameters: you're missing one of the required parameters in the request body (or may have specified something extra)

```
{
	"Error": [string] the error that caused this response
}
```

####401 (Unauthorised)
The credentials you supplied were invalid, so a token could not be generated.






##/api/users/renew *(GET)*

This endpoint allows a logged-in user to retrieve their full account details (minus their password) and a brand new JWT access token with an extended expiry date.

###Privileges required
- Must be logged in with valid token in order to generate a fresh one

###Responses

####200 (OK)
A fresh login access token has been generated. It will expire at the date/time indicated. Details about the logged in user are also supplied in the response.

```
{
	"Token": [string] JSON web token,
	"Expires": [int] token expiry (UNIX timestamp),
	"User": [private\_user] object of logged in user
}
```

####401 (Unauthorised)
You tried to get a new token but are not logged in.





##/api/users/signup *(POST)*

This endpoint allows you to create a new user account with the "contributor" role.

###Privileges required
- None

###Request

####Headers
- Content-Type: "application/json"

####Body
All values must be supplied.

```
{
	"Username": [string] username (3-15 chars, alphanumeric),
	"Email": [string] email address (must be valid email address),
	"Password": [string] password (>=8 chars, including at least 1 number, 1 letter),
	"Name": [string] name (1-30 chars)
	"Biography": [string] biography (>=1 character),
	"Summary": [string] summary of the contribution this user will be making to the event (>=1 character)
}
```

###Responses

####200 (OK)
The user account was created successfully, and a login access token has been generated. It will expire at the date/time indicated. Details about the new user are also supplied in the response.

```
{
	"Token": [string] JSON web token,
	"Expires": [int] token expiry (UNIX timestamp),
	"User": [private\_user] object of created user
}
```

####400 (Bad request)
There was something wrong with your request. The error will be one of the following:

- wrong\_content\_type: you didn't specify the Content-Type header correctly
- invalid\_json: the request body was not valid JSON
- invalid\_parameters: you're missing one of the required parameters in the request body (or may have specified something extra)
- bad\_username: the supplied username does not meet requirements
- bad\_email: the supplied email address does not meet requirements
- bad\_password: the supplied password does not meet requirements
- bad\_name: the supplied name does not meet requirements
- bad\_biography: the supplied biography does not meet requirements
- bad\_summary: the supplied summary does not meet requirements
- username\_exists: the supplied username is already in use
- email\_exists: the supplied email address is already in use

```
{
	"Error": [string] the error that caused this response
}
```






##/api/users/delete/[username] *(POST)*

This endpoint allows you to delete the user account with the specified [username].

###Privileges required
- Any user can delete their own account if the system is not locked
- Any user with the admin role can delete any account at any time

###Responses

####200 (OK)
The user account was deleted successfully. Note that if an admin user tries to delete a user that does not exist, no error will occur, but a 200 will be returned.

```
{
	"Error": [string] the error that caused this response
}
```







##/api/users/edit *(POST)*

This endpoint allows you to edit the properties of the logged in user account. 

###Privileges required
- Any logged in user

###Request

####Headers
- Content-Type: "application/json"

####Body
You should only specify the properties that you want to change. To change the password, you must specify *two* properties: ```CurrentPassword``` should be the account's current password (for verification of identity), and ```NewPassword``` should be the desired *new* password.

```
{
	"NewPassword": [string] new password (>=8 chars, including at least 1 number, 1 letter),
	"CurrentPassword": [string] current password (must be specified if NewPassword is specified),
	"Email": [string] email address (must be valid email address),
	"Name": [string] name (1-30 chars),
	"Biography": [string] biography (>=1 character),
	"Summary": [string] summary of the contribution this user will be making to the event (>=1 character)
}
```

###Responses

####200 (OK)
The user account was updated successfully.

####400 (Bad request)
There was something wrong with your request. The error will be one of the following:

- wrong\_content\_type: you didn't specify the Content-Type header correctly
- invalid\_json: the request body was not valid JSON
- invalid\_parameters: you're missing one of the required parameters in the request body (or may have specified something extra)
- wrong\_password: you specified the wrong password for CurrentPassword
- bad\_email: the supplied email address does not meet requirements
- bad\_password: the supplied new password does not meet requirements
- bad\_name: the supplied name does not meet requirements
- bad\_biography: the supplied biography does not meet requirements
- bad\_summary: the supplied summary does not meet requirements
- email\_exists: the supplied email address is already in use

```
{
	"Error": [string] the error that caused this response
}
```








##/api/users/details/[username] *(GET)*

This endpoint allows you to get details about the user with the specified [username].

###Privileges required
- Must be logged in

###Responses

####200 (OK)
The user account was updated successfully.

```
[user] object of requested user
```

####404 (Not found)
The user requested could not be found. The error will be one of the following:

- user\_not\_found: the username you specified does not exist

```
{
	"Error": [string] the error that caused this response
}
```

