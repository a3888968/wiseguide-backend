require('../../../support/common');

var userTestSupport = require('../support/common');

var User = global.db.User;

describe('User#checkPassword', function() {

  var exampleUser;

  beforeEach(function() {
    exampleUser = userTestSupport.buildExampleAdminUser();
    return exampleUser.save();
  });

  it('resolves with false if the password is wrong', function() {
    User.find({where: {username: 'admin_user'}}).then(function(user) {
      return expect(user.checkPassword('wrong')).to.eventually.equal(false);
    });
  });

  it('resolves with true if the password is right', function() {
    User.find({where: {username: exampleUser.username}}).then(function(user) {
      return expect(user.checkPassword('password')).to.eventually.equal(true);
    });
  });

});
