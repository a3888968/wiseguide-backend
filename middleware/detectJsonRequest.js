module.exports = function(req, res, next) {
  req.isJson = req.headers['Content-Type'] === 'application/json';
  next();
};
