const knex = require('knex');
const config = require('../../knexfile.sqlite');

const db = knex(config[process.env.NODE_ENV || 'development']);

module.exports = db;
