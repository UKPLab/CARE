'use strict';

const settings = [
    {
        key: "app.login.forgotPassword",
        type: "boolean", 
        value: "true",
        description: "Whether to show the forgot password link on the login page"
    },
    {
        key: "app.register.emailVerification",
        type: "boolean",
        value: "true",
        description: "Whether to require email verification for new user accounts"
    }
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const groups = await queryInterface.bulkInsert('setting', settings.map(t => {
            return {
                key: t.key,
                type: t.type,
                value: t.value,
                description: t.description,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        }));
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete("setting", {
            key: settings.map(t => t.key)
        });
    }
};
