require('../../../support/common');

var userTestSupport = require('../support/common');
var moment = require('moment');

describe('User#generateToken', function() {

  var exampleUser;

  beforeEach(function() {
    exampleUser = userTestSupport.buildExampleAdminUser();
  });

  it('returns a JSON web token as a string', function() {
    var result = exampleUser.generateToken();
    expect(result.token).to.be.a('string');
  });

  it('returns a valid future expiry time', function() {
    var result = exampleUser.generateToken();
    expect(moment(result.expiry).isValid()).to.eq(true);
    expect(moment(result.expiry).isAfter(moment())).to.eq(true);
  });

});
