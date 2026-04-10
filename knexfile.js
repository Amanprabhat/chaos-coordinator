require('dotenv').config();
const path = require('path');

/**
 * Knex configuration for all environments.
 *
 * Development  → SQLite  (zero-config, local file)
 * Production   → PostgreSQL (set DATABASE_URL in environment)
 *
 * Run migrations:
 *   npm run db:migrate           (uses NODE_ENV to pick config)
 *   npm run db:migrate:prod      (forces production/PostgreSQL)
 */

module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: path.join(__dirname, 'server', 'database', 'database.sqlite')
    },
    migrations: {
      directory: path.join(__dirname, 'server', 'database', 'migrations'),
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: path.join(__dirname, 'server', 'database', 'seeds')
    },
    useNullAsDefault: true
  },

  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    migrations: {
      directory: path.join(__dirname, 'server', 'database', 'migrations'),
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: path.join(__dirname, 'server', 'database', 'seeds')
    },
    pool: {
      min: 2,
      max: 10
    }
  }
};
