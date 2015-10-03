var Umzug = require('umzug');
var umzug = new Umzug({
  storageOptions: {
    sequelize: require('db'),
  },
});

umzug.up().then(function() {
  console.log('Migrations complete');
});
