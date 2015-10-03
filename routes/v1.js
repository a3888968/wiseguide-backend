var express = require('express');

module.exports = function(app) {
  var router = express.Router();

  router.use('/users', require('./v1/users')(app));

  return router;
};

