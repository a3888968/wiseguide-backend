require('../../../support/common');

var userTestSupport = require('../support/common');
var moment = require('moment');

var User = global.db.User;

describe('User#generateToken', function() {

  var exampleUser;

  beforeEach(function() {
    exampleUser = userTestSupport.buildExampleAdminUser();
    return exampleUser.save();
  });

  it('returns a token string and an expiry time in the future', function() {
    var result = exampleUser.generateToken();
    expect(result.token).to.be.a('string');
    expect(result.expiry.isAfter(moment())).to.equal(true);
  });

});
