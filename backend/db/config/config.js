/**
 * Configuration File to define the database used for Sequelize
 *
 * @author Nils Dycke
 */
const path = require("path");
require("dotenv").config({path: path.resolve(__dirname, "../../../.env")});

module.exports = {
    development: {
        username: 'postgres',
        password: null,
        database: process.env.POSTGRES_CAREDB,
        host: process.env.POSTGRES_HOST,
        port: process.env.POSTGRES_PORT,
        dialect: 'postgres',
        dialectOptions: {
            idle_in_transaction_session_timeout: 60000 // 60s
        },
        pool: {
            max: 45, // default 5
            min: 0, // default 0
            acquire: 60000, //default 60000
            idle: 10000 //default 10000
        }
    },
    test: {
        username: 'postgres',
        password: null,
        database: process.env.POSTGRES_TESTDB,
        host: process.env.POSTGRES_HOST,
        port: process.env.POSTGRES_PORT,
        dialect: 'postgres',
        dialectOptions: {
            idle_in_transaction_session_timeout: 60000 // 60s
        },
        pool: {
            max: 45, // default 5
            min: 0, // default 0
            acquire: 60000, //default 60000
            idle: 10000 //default 10000
        },
        logging: false
    },
    production: {
        username: 'postgres',
        password: null,
        database: process.env.POSTGRES_CAREDB,
        host: process.env.POSTGRES_HOST,
        port: process.env.POSTGRES_PORT,
        dialect: 'postgres',
        dialectOptions: {
            idle_in_transaction_session_timeout: 60000 // 60s
        },
        pool: {
            max: 45, // default 5
            min: 0, // default 0
            acquire: 60000, //default 60000
            idle: 10000 //default 10000
        },
        logging: false
    },
};