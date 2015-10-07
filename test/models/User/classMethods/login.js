require('../../../support/common');

var userTestSupport = require('../support/common');

var User = global.db.User;

describe('User.login', function() {

  var exampleUser;

  beforeEach(function() {
    exampleUser = userTestSupport.buildExampleAdminUser();
    return exampleUser.save();
  });

  it('rejects if the user does not exist', function() {
    return expect(User.login('imaginary_user', 'some_password')).to.eventually.be.rejected;
  });

  describe('when called with existing username', function() {
    validUserExamples('admin_user');
  });

  describe('when called with existing email address', function() {
    validUserExamples('admin@email.xyz');
  });

  function validUserExamples(usernameOrEmail) {
    it('rejects if the password is incorrect', function() {
      return expect(User.login(usernameOrEmail, 'wrong_password')).to.eventually.be.rejected;
    });

    it('resolves with the user, a token, and a future expiry time if password correct', function() {
      return User.login(usernameOrEmail, 'password').then(function(result) {
        expect(result.user.email).to.equal(exampleUser.email);
        expect(result.user.username).to.equal(exampleUser.username);
        expect(result.user.role).to.equal(exampleUser.role);
      });
    });
  }

});
