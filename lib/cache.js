var Memcached = require('memcached');
var memcached = new Memcached(process.env.MEMCACHED_HOST);

function finish(resolve, reject, err, data) {
  if (err) {
    reject(err);
  } else {
    resolve(data);
  }
}

module.exports = {

  add: function(key, value, lifetime) {
    return new Promise(function(resolve, reject) {
      memcached.add(key, value, lifetime, function(err, data) { finish(resolve, reject, err, data); });
    });
  },

  del: function(key) {
    return new Promise(function(resolve, reject) {
      memcached.del(key, function(err, data) { finish(resolve, reject, err, data); });
    });
  },

  get: function(key) {
    return new Promise(function(resolve, reject) {
      memcached.get(key, function(err, data) { finish(resolve, reject, err, data); });
    });
  },

  getMulti: function(keys) {
    return new Promise(function(resolve, reject) {
      memcached.getMulti(keys, function(err, data) { finish(resolve, reject, err, data); });
    });
  },

  replace: function(key, value, lifetime) {
    return new Promise(function(resolve, reject) {
      memcached.replace(key, value, lifetime, function(err, data) { finish(resolve, reject, err, data); });
    });
  },

  set: function(key, value, lifetime) {
    return new Promise(function(resolve, reject) {
      memcached.set(key, value, lifetime, function(err, data) { finish(resolve, reject, err, data); });
    });
  },

  touch: function(key, lifetime) {
    return new Promise(function(resolve, reject) {
      memcached.touch(key, lifetime, function(err, data) { finish(resolve, reject, err, data); });
    });
  },

};
