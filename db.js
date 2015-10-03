var Sequelize = require('sequelize');

var sequelize = new Sequelize(
  process.env.DATABASE_NAME_ROOT + "_" + process.env.NODE_ENV,
  process.env.DATABASE_USERNAME,
  process.env.DATABASE_PASSWORD,
  {
    host: process.env.DATABASE_HOST,
    dialect: 'postgres',
    pool: {
      max: 5,
      min: 0,
      idle: 10000
    }
  }
);

module.exports = sequelize;