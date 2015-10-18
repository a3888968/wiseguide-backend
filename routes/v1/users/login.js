var express = require('express');
var validator = require('validator');
var rejectNonJsonRequest = require('../../../middleware/rejectNonJsonRequest');

module.exports = function(app) {
  var router = express.Router();

  router.post('/login', rejectNonJsonRequest, function(req, res, next) {
    if (typeof req.body.username !== 'string' ||
        typeof req.body.password !== 'string') {
      var validationError = new Error('Bad request');
      validationError.status = 400;
      validationError.expected = true;
      return next(validationError);
    }
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
          return next(loginError);
        } else {
          return next(err);
        }
      });
  });

  return router;
};

