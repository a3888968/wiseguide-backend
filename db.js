var Sequelize = require('sequelize');

var envKeyPrefix = process.env.NODE_ENV === "test" ? "TEST_" : "";

var sequelize = new Sequelize(
  process.env[envKeyPrefix + 'DATABASE_NAME'],
  process.env[envKeyPrefix + 'DATABASE_USERNAME'],
  process.env[envKeyPrefix + 'DATABASE_PASSWORD'],
  {
    host: process.env[envKeyPrefix + 'DATABASE_HOST'],
    port: process.env[envKeyPrefix + 'DATABASE_PORT'],
    dialect: 'postgres',
    pool: {
      max: 5,
      min: 0,
      idle: 10000
    }
  }
);

module.exports = sequelize;