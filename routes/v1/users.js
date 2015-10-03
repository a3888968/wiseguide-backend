var express = require('express');

module.exports = function(app) {
  var router = express.Router();

  router.use(require('./users/login')(app));

  return router;
};

