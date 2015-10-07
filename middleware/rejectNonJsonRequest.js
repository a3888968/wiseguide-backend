module.exports = function(req, res, next) {
  if (!req.isJson) {
    res.status(400).json({
      error: 'Content-Type should be application/json'
    }).send();
  } else {
    next();
  }
};
