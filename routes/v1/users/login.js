var express = require('express');
var rejectNonJsonRequest = require('../../../middleware/rejectNonJsonRequest');

module.exports = function(app) {
  var router = express.Router();

  router.post('/login', rejectNonJsonRequest, function(req, res, next) {
    app.get('models').User.login(req.body.username, req.body.password)
      .then(function(result) {
        return res.status(200).json({
          token: result.token,
          expiry: result.expiry,
        }).send();
      }, function(err) {
        if (err.message === 'bad-login') {
          var loginError = new Error('Invalid username or password');
          loginError.status = 401;
          loginError.expected = true;
          next(loginError);
        } else {
          next(err);
        }
      });
  });

  return router;
};

