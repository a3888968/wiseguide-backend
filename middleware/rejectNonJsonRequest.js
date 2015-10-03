module.exports = function(req, res, next) {
  if (req.isJson) {
    res.sendError(400, 'JSON Content Type required');
  } else {
    next();
  }
};
