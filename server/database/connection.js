const knex = require('knex');
const config = require('../../knexfile.sqlite.js');

const db = knex(config[process.env.NODE_ENV || 'development']);

module.exports = db;
