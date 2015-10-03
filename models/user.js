'use strict';

module.exports = function(sequelize, DataTypes) {
  var User = sequelize.define('User', {
    email: {type: DataTypes.STRING, allowNull: false, unique: true},
    username: {type: DataTypes.STRING, allowNull: false, unique: true},
    password: {type: DataTypes.STRING, allowNull: false},
    displayName: {type: DataTypes.STRING, allowNull: false},
    role: {
      type: DataTypes.ENUM('admin', 'editor', 'contributor'),
      allowNull: false
    },
  }, {
    classMethods: {
      login: require('./user/classMethods/login'),
    },
    instanceMethods: {
      generateToken: require('./user/instanceMethods/generateToken'),
    }
  });

  return User;
};
