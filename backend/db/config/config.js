/**
 * Configuration File to define the database used for Sequelize
 *
 * @fileoverview Configuration File for Sequelize
 * @author Nils Dycke (
 */

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
        logging: false
    },
    production: {
        username: 'postgres',
        password: null,
        database: process.env.POSTGRES_PEERDB,
        host: process.env.POSTGRES_HOST,
        port: process.env.POSTGRES_PORT,
        dialect: 'postgres',
        logging: false
    },
};