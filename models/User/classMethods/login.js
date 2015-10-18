var Promise = require('promise');
var validator = require('validator');

/*
  Given valid user credentials, generates a JSON web token
  which can be used to authenticate later requests.
  Supply:
  1. the given username or email address (String)
  2. the given plaintext password (String)
  Returns a promise that resolves with an object of the form
  {
    user: User,
    token: string,
    expiry: moment object
  }
*/
module.exports = function(usernameOrEmail, givenPassword) {
  var query = validator.isEmail(usernameOrEmail) ? {
    email: usernameOrEmail.toLowerCase()
  } : {
    username: usernameOrEmail.toLowerCase()
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
      return new Promise(function(resolve, reject) {
        user.checkPassword(givenPassword).then(function(correct) {
          if (correct) {
            var result = user.generateToken();
            result.user = user;
            resolve(result);
          } else {
            reject(new Error('bad-login'));
          }
        });
      });
    });
};
