'use strict';

module.exports = function(sequelize, DataTypes) {
  var User = sequelize.define('User', {
    email: {type: DataTypes.STRING, allowNull: false, unique: true},
    username: {type: DataTypes.STRING, allowNull: false, unique: true},
    password: {type: DataTypes.STRING, allowNull: false},
    role: {
      type: DataTypes.ENUM('admin', 'editor', 'contributor'),
      allowNull: false
    },
  }, {
    classMethods: {
      login: require('./User/classMethods/login'),
    },
    instanceMethods: {
      checkPassword: require('./User/instanceMethods/checkPassword'),
      generateToken: require('./User/instanceMethods/generateToken'),
    }
  });

  return User;
};
