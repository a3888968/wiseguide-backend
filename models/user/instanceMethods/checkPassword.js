var hashUtils = require('../../../lib/hashUtils');

/*
  Checks a given password against the stored hash
  to see if its correct.
  Supply:
  1. The given plaintext password to check (String)
  Returns:
  A promise which resolves to a Boolean:
  - true if password correct
  - false otherwise
*/
module.exports = function(givenPassword) {
  var self = this;

  return hashUtils.check(givenPassword, self.password);
};
