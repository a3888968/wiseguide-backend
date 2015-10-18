var support = require('./support');

describe('POST /v1/users/login', function() {

  function login(body) {
    return request.post('/v1/users/login').send(body);
  }

  describe('with bad request', function() {

    it('returns 400 if username is missing', function(done) {
      login({password: 'some-password-123'})
        .expect(400, done);
    });

    it('returns 400 if password is missing', function(done) {
      login({username: 'my-username'})
        .expect(400, done);
    });

    it('returns 400 if not a JSON request', function(done) {
      login('{"username":"didnt-set", "password":"the-content-type-properly"}')
        .set('Content-Type', 'text/plain')
        .expect(400, done);
    });

  });

  describe('with non-existent account', function() {

    it('returns 401 if the account doesnt exist', function(done) {
      login({username: 'non-existent-user', password: 'doesnt-matter'})
        .expect(401, done);
    });

  });

  describe('with existing account', function() {

    beforeEach(function() {
      return support.buildExampleAdminUser().save();
    });

    describe('with correct username', function() { validAccountCases('admin_user'); });
    describe('with correct username in different case', function() { validAccountCases('ADMIN_USER'); });
    describe('with correct email', function() { validAccountCases('admin@email.xyz'); });
    describe('with correct email in different case', function() { validAccountCases('ADMIN@EMAIL.XYZ'); });

    function validAccountCases(usernameOrEmail) {

      it('returns 200 if the password is correct', function(done) {
        login({username: usernameOrEmail, password: 'password'})
          .expect(200, done);
      });

      it('returns 401 if the password is incorrect', function(done) {
        login({username: usernameOrEmail, password: 'wrong-password'})
          .expect(401, done);
      });

      it('returns 401 if the password is in wrong case', function(done) {
        login({username: usernameOrEmail, password: 'PASSWORD'})
          .expect(401, done);
      });

    }

  });

});
