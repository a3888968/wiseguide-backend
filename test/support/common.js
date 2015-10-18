'use strict';

/* set environment */
require('../../loadEnv');
process.env.NODE_ENV = 'test';

/* chai assertions */
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

global.chaiAsPromised = chaiAsPromised;
global.expect = chai.expect;

/* for making requests */
global.request = require('supertest')(require('../../app'));

/* database models */
global.db = require('../../models/index');

beforeEach(function() {
  /* wipe database */
  return global.db.sequelize.sync({force: true});
});

describe('* Initial test set-up suite', function() {
  it('forces inclusion of test set-up code', function() {});
});
