'use strict';

const columns = [
    {
        name: 'emailVerified',
        type: 'BOOLEAN',
        defaultValue: false,
        allowNull: false
    },
    {
        name: 'emailVerificationToken',
        type: 'STRING',
        allowNull: true
    },
    {
        name: 'resetToken',
        type: 'STRING',
        allowNull: true
    }
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        for (const column of columns) {
            await queryInterface.addColumn('user', column.name, {
                type: Sequelize[column.type],
                defaultValue: column.defaultValue,
                allowNull: column.allowNull
            });
        }
    },

    async down(queryInterface, Sequelize) {
        for (const column of columns) {
            await queryInterface.removeColumn('users', column.name);
        }
    }
};
