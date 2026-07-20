'use strict';

const { genSalt, genPwdHash } = require('../../utils/auth');

// True if any non-deleted user has logged in (already-set-up instance).
async function hasAnyUserLoggedIn(queryInterface) {
    const rows = await queryInterface.sequelize.query(
        `SELECT 1 AS present FROM "user"
         WHERE "lastLoginAt" IS NOT NULL
           AND "deleted" = false
         LIMIT 1`,
        { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    return !!(rows && rows.length > 0);
}

/**
 * Removes the default admin user created by basic-users so the first admin
 * must be created via the setup wizard. Runs after basic-configuration; all
 * configurations owned by the default admin are first reassigned to Bot (userId 2)
 * to satisfy the configuration.userId FK, then the admin is deleted.
 * POST /auth/setup-admin reassigns those configurations from Bot to the new admin.
 *
 * Skip on already-set-up instances (any user with lastLoginAt set).
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

        // Keep default admin and leave configs as-is on old / already-used instances.
        if (await hasAnyUserLoggedIn(queryInterface)) {
            return;
        }

        const adminId = admin.id;
        const BOT_USER_ID = 2;
        const transaction = await queryInterface.sequelize.transaction();
        try {
            await queryInterface.sequelize.query(
                `UPDATE configuration SET "userId" = :botId, "updatedAt" = :now WHERE "userId" = :adminId`,
                {
                    replacements: { botId: BOT_USER_ID, adminId, now: new Date() },
                    type: Sequelize.QueryTypes.UPDATE,
                    transaction,
                }
            );

            await queryInterface.bulkDelete('user_role_matching', { userId: adminId }, { transaction });
            await queryInterface.bulkDelete('user', { userName: 'admin' }, { transaction });
            await transaction.commit();
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
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
