/* Configuration File for Sequelize

Configuration File to define the database used for Sequelize

Author: Nils Dycke (dycke@ukp.informatik...)
*/
const path = require('path');
//require('dotenv').config({path: path.resolve(__dirname, "../../../.env")});

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
        database: process.env.POSTGRES_TESTDB,
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