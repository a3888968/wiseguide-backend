'use strict';

module.exports = {
  up: function(queryInterface, Sequelize) {
    return queryInterface.createTable(
      'Users',
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        createdAt: {
          type: Sequelize.DATE
        },
        updatedAt: {
          type: Sequelize.DATE
        },
        email: {type: Sequelize.STRING, allowNull: false, unique: true},
        username: {type: Sequelize.STRING, allowNull: false, unique: true},
        password: {type: Sequelize.STRING, allowNull: false},
        role: {
          type: Sequelize.ENUM('admin', 'editor', 'contributor'),
          allowNull: false
        },
      }
    );
  },

  down: function(queryInterface, Sequelize) {
    return queryInterface.dropTable('Users');
  }
};
