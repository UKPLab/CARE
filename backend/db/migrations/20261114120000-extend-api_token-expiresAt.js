'use strict';

/**
 * API tokens can carry an expiry date. Null means the token does not expire.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('api_token', 'expiresAt', {
            type: Sequelize.DATE,
            allowNull: true,
            defaultValue: null,
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('api_token', 'expiresAt');
    },
};
