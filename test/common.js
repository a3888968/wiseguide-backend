'use strict';

var config = require('../utils/config'),
    supertest = require('supertest'),
    // app = require('../app'),
    // request = supertest(app),
    requestLoc = supertest(config.hostUrl);

global.should = require('chai').should();
global.expect = require('chai').expect;
global.request = requestLoc;