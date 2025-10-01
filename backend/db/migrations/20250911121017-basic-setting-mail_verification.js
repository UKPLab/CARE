'use strict';

const settings = [
    {
        key: "app.login.forgotPassword",
        type: "boolean",
        value: "true",
        description: "Whether to enable the forgot password functionality or not"
    },
    {
        key: "app.register.emailVerification",
        type: "boolean",
        value: "true",
        description: "Whether to require email verification for new user accounts"
    },
    {
        key: "system.baseUrl",
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
    {
        key: "app.login.passwordResetRateLimit",
        value: "5",
        type: "number",
        description: "Rate limit in minutes for password reset emails to prevent spam"
    },
    {
        key: "app.register.emailVerificationRateLimit",
        value: "2",
        type: "number",
        description: "Rate limit in minutes for email verification emails to prevent spam"
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
