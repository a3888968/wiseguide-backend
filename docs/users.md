# /users

## /login

Obtain a JSON web token which can be used to authenticate other requests

### Request format

```json
{
  "username": String - the username or email address of the account,
  "password": String - the password of the account
}
```

### Successful response format

Status code: 200

```json
{
  "token": String - the JSON web token,
  "expiry": String - ISO 8601 representation of token expiry time
}
```