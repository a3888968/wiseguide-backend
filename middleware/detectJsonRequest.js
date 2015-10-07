module.exports = function(req, res, next) {
  req.isJson = req.headers['content-type'].indexOf('application/json') !== -1;
  next();
};
