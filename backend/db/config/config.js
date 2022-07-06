const path = require('path');
require('dotenv').config({path: path.resolve(__dirname, "../../../.env")});
const fs = require('fs');

module.exports = {
  development: {
    username: 'postgres',
    password: null,
    database: process.env.POSTGRES_PEERDB,
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    dialect: 'postgres',
  },
  test: {
    username: 'postgres',
    password: null,
    database: process.env.POSTGRES_PEERDB,
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    dialect: 'postgres',
  },
  production: {
    username: 'postgres',
    password: null,
    database: process.env.POSTGRES_PEERDB,
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    dialect: 'postgres',
  },
};