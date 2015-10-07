var jwt = require('jsonwebtoken');
var moment = require('moment');

/*
  Generates a JSON web token for the user.
  Returns an object of the form
  {
    token: string,
    expiry: moment object
  }
*/
module.exports = function() {
  var self = this;

  var expiry = moment().add(process.env.JWT_DAYS_OF_VALIDITY, 'days');
  var token = jwt.sign({
    iss: process.env.JWT_ISSUER,
    sub: self.username,
    exp: expiry.unix()
  }, process.env.JWT_SECRET_KEY);
  return {token: token, expiry: expiry};
};
