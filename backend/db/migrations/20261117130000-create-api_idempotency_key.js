'use strict';

/**
 * Remembers the answer to a creating REST request sent with an Idempotency-Key header, so a retry
 * with the same key returns that answer instead of creating the thing twice. Rows older than
 * 24 hours are ignored and removed.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('api_idempotency_key', {
            id: {allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER},
            userId: {allowNull: false, type: Sequelize.INTEGER, references: {model: 'user', key: 'id'}},
            idempotencyKey: {allowNull: false, type: Sequelize.STRING(255)},
            method: {allowNull: false, type: Sequelize.STRING(10)},
            path: {allowNull: false, type: Sequelize.STRING(512)},
            requestHash: {allowNull: false, type: Sequelize.STRING(64)},
            statusCode: {allowNull: true, type: Sequelize.INTEGER},
            responseBody: {allowNull: true, type: Sequelize.JSONB},
            deleted: {type: Sequelize.BOOLEAN, defaultValue: false},
            createdAt: {allowNull: false, type: Sequelize.DATE},
            updatedAt: {allowNull: false, type: Sequelize.DATE},
            deletedAt: {type: Sequelize.DATE, allowNull: true, defaultValue: null},
        });
        await queryInterface.addIndex('api_idempotency_key', ['userId', 'idempotencyKey'], {unique: true});
        await queryInterface.addIndex('api_idempotency_key', ['createdAt']);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('api_idempotency_key');
    },
};
