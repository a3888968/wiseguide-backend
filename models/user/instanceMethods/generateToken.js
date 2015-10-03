var jwt = require('jsonwebtoken');
var moment = require('moment');

var hashUtils = require('../../../lib/hashUtils');

/*
  Generates a JSON web token for the user.
  Returns a promise that resolves with an object of the form
  {
    token: string,
    expiry: moment object
  }
*/
module.exports = function(givenPassword) {
  var self = this;

  return checkUserAndPassword().then(function() {
    return new Promise(function(resolve, reject) {
      var expiry = moment().add(process.env.JWT_DAYS_OF_VALIDITY, 'days');
      var token;
      try {
        token = jwt.sign({
          iss: process.env.JWT_ISSUER,
          sub: self.username,
          exp: expiry.unix()
        }, process.env.JWT_SECRET_KEY);
      } catch (error) {
        return reject(error);
      }
      resolve({token: token, expiry: expiry});
    });
  });

  function checkUserAndPassword() {
    return new Promise(function(resolve, reject) {
      hashUtils
        .check(givenPassword, self.password)
        .then(function(checkPassed) {
          if (checkPassed) {
            resolve();
          } else {
            reject(new Error('bad-login'));
          }
        }, reject);
    });
  }
};
