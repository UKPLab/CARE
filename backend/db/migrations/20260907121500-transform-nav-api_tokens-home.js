'use strict';

/**
 * Sidebar hides nav_group Default. Move API Tokens into Home (with Documents).
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        const homeId = await queryInterface.rawSelect(
            'nav_group',
            {where: {name: 'Home'}},
            ['id']
        );
        if (!homeId) {
            return;
        }
        await queryInterface.bulkUpdate(
            'nav_element',
            {groupId: homeId, order: 4, updatedAt: new Date()},
            {name: 'API Tokens'}
        );
    },

    async down(queryInterface) {
        const defaultId = await queryInterface.rawSelect(
            'nav_group',
            {where: {name: 'Default'}},
            ['id']
        );
        if (!defaultId) {
            return;
        }
        await queryInterface.bulkUpdate(
            'nav_element',
            {groupId: defaultId, order: 16, updatedAt: new Date()},
            {name: 'API Tokens'}
        );
    },
};
