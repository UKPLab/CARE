'use strict';

const { genSalt, genPwdHash } = require('../../utils/auth');

/**
 * Names of the 5 Exposé configurations created by basic-configuration (20250919125851).
 * They are reassigned to Bot (userId 2) before deleting the admin to satisfy the
 * configuration.userId FK to user. POST /auth/setup-admin then reassigns them to the new admin.
 */
const EXPOSE_CONFIG_NAMES = [
    'Exposé assessment configuration',
    'Exposé feedback configuration',
    'UKP Exposé Submission Validator',
    'Exposé assessment configuration (German)',
    'Exposé feedback configuration (German)',
];

/**
 * Removes the default admin user created by basic-users so the first admin
 * must be created via the setup wizard. Runs after basic-configuration; the 5
 * Exposé configs are first reassigned to Bot (userId 2) to satisfy the FK, then
 * the admin is deleted. POST /auth/setup-admin reassigns them from Bot to the new admin.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        const rows = await queryInterface.sequelize.query(
            'SELECT id FROM "user" WHERE "userName" = \'admin\' AND "deleted" = false',
            { type: queryInterface.sequelize.QueryTypes.SELECT }
        );
        const admin = rows && rows[0];
        if (!admin) {
            return;
        }
        const adminId = admin.id;
        const BOT_USER_ID = 2;

        for (const name of EXPOSE_CONFIG_NAMES) {
            await queryInterface.sequelize.query(
                `UPDATE configuration SET "userId" = :botId, "updatedAt" = :now WHERE name = :name AND "userId" = :adminId`,
                {
                    replacements: { botId: BOT_USER_ID, adminId, name, now: new Date() },
                    type: Sequelize.QueryTypes.UPDATE,
                }
            );
        }

        await queryInterface.bulkDelete('user_role_matching', { userId: adminId }, {});
        await queryInterface.bulkDelete('user', { userName: 'admin' }, {});
    },

    async down(queryInterface, Sequelize) {
        const salt = genSalt();
        const passwordHash = await genPwdHash(process.env.ADMIN_PWD || 'admin', salt);
        const email = process.env.ADMIN_EMAIL || 'admin@localhost';
        const now = new Date();

        await queryInterface.bulkInsert('user', [{
            firstName: 'admin',
            lastName: 'user',
            userName: 'admin',
            email: email,
            passwordHash: passwordHash,
            salt: salt,
            acceptStats: true,
            acceptTerms: true,
            deleted: false,
            createdAt: now,
            updatedAt: now,
        }], {});

        const userRows = await queryInterface.sequelize.query(
            'SELECT id FROM "user" WHERE "userName" = \'admin\'',
            { type: queryInterface.sequelize.QueryTypes.SELECT }
        );
        const roleRows = await queryInterface.sequelize.query(
            'SELECT id FROM "user_role" WHERE name = \'admin\'',
            { type: queryInterface.sequelize.QueryTypes.SELECT }
        );
        const inserted = userRows && userRows[0];
        const adminRole = roleRows && roleRows[0];
        if (inserted && adminRole) {
            await queryInterface.bulkInsert('user_role_matching', [{
                userId: inserted.id,
                userRoleId: adminRole.id,
                deleted: false,
                createdAt: now,
                updatedAt: now,
                deletedAt: null,
            }], {});
        }
    },
};
