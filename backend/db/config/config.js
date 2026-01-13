/**
 * Configuration File to define the database used for Sequelize
 *
 * @author Nils Dycke
 */
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
        logging: false
    },
};