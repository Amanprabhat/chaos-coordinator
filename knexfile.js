require('dotenv').config();
module.exports = {
  development: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'chaos_coordinator',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password'
    },
    migrations: {
      directory: './server/database/migrations'
    },
    seeds: {
      directory: './server/database/seeds'
    }
  },
  production: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: './server/database/migrations'
    },
    seeds: {
      directory: './server/database/seeds'
    }
  }
};
