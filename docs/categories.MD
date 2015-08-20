#/api/categories Endpoints


##/api/categories/create *(POST)*

This endpoint allows an administrator to create a new event category.

###Privileges required
- A user with the "admin" role

###Request

####Headers
- Content-Type: "application/json"

####Body
All values must be supplied.

```
{
	"Name": [string] unique category name (alphanumeric (spaces allowed), 3-15 chars)
}
```

###Responses

####200 (OK)
The category was created successfully.

####400 (Bad request)
There was something wrong with your request. The error will be one of the following:

- wrong\_content\_type: you didn't specify the Content-Type header correctly
- invalid\_json: the request body was not valid JSON
- bad\_name: the name you supplied was invalid
- category\_exists: there's already a category with that name

```
{
	"Error": [string] the error that caused this response
}
```



##/api/categories/delete/[category name] *(POST)*

This endpoint allows an administrator to delete an existing event category. It will also be removed from any events it appears on.

###Privileges required
- A user with the "admin" role

###Responses

####200 (OK)
The category was deleted successfully.

####404 (Not found)
The category could not be found. The error will be one of the following:

- category\_not\_found: the category you specified doesn't exist

```
{
	"Error": [string] the error that caused this response
}
```



##/api/categories/edit/[category name] *(POST)*

This endpoint allows an administrator to change the name of an existing event category. It will also be changed on any events it appears on.

###Privileges required
- A user with the "admin" role

###Request

####Headers
- Content-Type: "application/json"

####Body
All values must be supplied.

```
{
	"Name": [string] unique category name (alphanumeric (spaces allowed), 3-15 chars)
}
```

###Responses

####200 (OK)
The category was edited successfully.

####400 (Bad request)
There was something wrong with your request. The error will be one of the following:

- wrong\_content\_type: you didn't specify the Content-Type header correctly
- invalid\_json: the request body was not valid JSON
- bad\_name: the name you supplied was invalid
- category\_exists: there's already a category with that name

```
{
	"Error": [string] the error that caused this response
}
```

####404 (Not found)
The category could not be found. The error will be one of the following:

- category\_not\_found: the category you specified doesn't exist

```
{
	"Error": [string] the error that caused this response
}
```




##/api/categories/all *(GET)*

This endpoint allows anyone to get a list of all categories supported by this system.

###Privileges required
- None

###Responses

####200 (OK)
```
{
	"Categories": [array[string]] a list of categories sorted by this system
}
```
