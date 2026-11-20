'use strict';

/**
 * Index on user_role_matching.userId. Every role lookup (sockets, REST token checks) asks for one
 * user's roles; without the index each lookup reads the whole table.
 */

const INDEX_NAME = 'user_role_matching_user_id';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        await queryInterface.addIndex('user_role_matching', ['userId'], {name: INDEX_NAME});
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('user_role_matching', INDEX_NAME);
    },
};
