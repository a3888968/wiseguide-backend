var User = global.db.User;

module.exports = {

  buildExampleAdminUser: function() {
    return User.build({
      email: 'admin@email.xyz',
      username: 'admin_user',
      // Hash of 'password'
      password: '$2a$10$JUZzrw303qE3uNsi.GBjJeamymZzk5DZjPKpLI4tG1GfIPaLcZ6b2',
      role: 'admin'
    });
  }

};
