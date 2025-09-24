'use strict';

const settings = [
    {
      key: "system.mailService.url",
      value: "localhost:3000",
      type: "string",
      description: "The URL of the redirection for links in emails (e.g. password reset)"
    },
    {
      key: "system.auth.tokenExpiry.passwordReset",
      value: "1",
      type: "number",
      description: "Password reset token expiration time in hours"
    },
    {
      key: "system.auth.tokenExpiry.emailVerification",
      value: "24",
      type: "number",
      description: "Email verification token expiration time in hours"
    },
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
