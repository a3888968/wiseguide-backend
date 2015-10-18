require('../../../support/common');

var userTestSupport = require('../support/common');

describe('User#checkPassword', function() {

  var exampleUser;

  beforeEach(function() {
    exampleUser = userTestSupport.buildExampleAdminUser();
  });

  it('resolves with false if the password is wrong', function() {
    return expect(exampleUser.checkPassword('wrong')).to.eventually.equal(false);
  });

  it('resolves with true if the password is right', function() {
    return expect(exampleUser.checkPassword('password')).to.eventually.equal(true);
  });

});
