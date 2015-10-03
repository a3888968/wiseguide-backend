var Promise = require('promise');
var validator = require('validator');

/*
  Given valid user credentials, generates a JSON web token
  which can be used to authenticate later requests.
  Supply:
  1. the given username or email address
  2. the given password
  Returns a promise that resolves with an object of the form
  {
    user: User,
    token: string,
    expiry: moment object
  }
*/
module.exports = function(usernameOrEmail, givenPassword) {
  var user;
  var query = validator.isEmail(usernameOrEmail) ? {
    email: usernameOrEmail
  } : {
    username: usernameOrEmail
  };

  return this.findOne({where: query})
    .then(function(user) {
      return new Promise(function(resolve, reject) {
        if (user) {
          resolve(user);
        } else {
          reject(new Error('bad-login'));
        }
      });
    })
    .then(function(user) {
      return user.generateToken(givenPassword);
    })
    .then(function(result) {
      return new Promise(function(resolve) {
        result.user = user;
        resolve(result);
      });
    });
};
