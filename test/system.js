'use strict';

var main = require('./main');

function makeLockSystemRequest(shouldLock, token) {
    return main.postWithToken('/api/system/' + (shouldLock ? 'lock' : 'unlock'), token);
}

function lockSystem(shouldLock, token, cb) {
    if (typeof token === 'function') {
        cb = token;
        token = undefined;
    }
    makeLockSystemRequest(shouldLock, token === undefined ? main.adminToken : token)
        .expect(200, cb);
}

exports.lockSystem = lockSystem;