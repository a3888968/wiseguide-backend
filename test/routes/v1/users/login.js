var support = require('./support');
var moment = require('moment');

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

      describe('with correct password', function() {

        beforeEach(function() {
          this.login = login({username: usernameOrEmail, password: 'password'});
        });

        it('returns 200', function(done) {
          this.login.expect(200, done);
        });

        it('returns a string in the token field of the body', function(done) {
          this.login.expect(function(res) {
            if (typeof res.body.token !== 'string') { throw new Error('token wasnt a string'); }
          }).end(done);
        });

        it('returns a valid future date in the expiry field of the body', function(done) {
          this.login.expect(function(res) {
            var date = moment(res.body.expiry);
            if (!date.isValid()) { throw new Error('date wasnt valid'); }
            if (!date.isAfter(moment())) { throw new Error('date not in future'); }
          }).end(done);
        });

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
