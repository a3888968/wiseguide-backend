var bcrypt = require('bcryptjs');
var Promise = require('promise');

module.exports = {

  hash: function(password) {
    return new Promise(function(resolve, reject) {
      bcrypt.genSalt(10, function(err, salt) {
        bcrypt.hash(password, salt, function(err, hash) {
          if (err) {
            reject(err);
          } else {
            resolve(hash);
          }
        });
      });
    });
  },

  check: function(password, hash) {
    return new Promise(function(resolve, reject) {
      bcrypt.compare(password, hash, function(err, res) {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      });
    });
  },

};
