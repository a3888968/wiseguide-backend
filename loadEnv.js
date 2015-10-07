require('node-env-file')('.env', {raise: false});
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
