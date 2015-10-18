var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var detectJsonRequest = require('./middleware/detectJsonRequest.js');

var app = express();

// attach data models to app (to prevent multiple db connections)
app.set('models', require('./models/index'));

// middleware
if (process.env.NODE_ENV !== 'test') {
  app.use(logger('dev'));
}
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(detectJsonRequest);
app.use(express.static(path.join(__dirname, 'public')));

// api endpoints
app.use('/v1', require('./routes/v1')(app));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Endpoint does not exist');
  err.status = 404;
  err.expected = true;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  if (!err.expected) {
    console.error('=========\nUNEXPECTED ERROR\n', err.stack, '\n=========');
  }
  res.status(err.status || 500).json({
    error: err.expected ? err.message : 'Unexpected server error'
  }).send();
});

module.exports = app;
