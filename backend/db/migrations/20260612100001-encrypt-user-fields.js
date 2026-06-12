'use strict';

/**
 * Encrypt existing plaintext values in user fields: firstName, lastName, email, initialPassword.
 * Also populates emailHash from the newly encrypted email value.
 *
 * Requires DB_ENCRYPTION_KEY to be set in the environment.
 * Skips rows where the field already appears encrypted (safe to re-run).
 */

const { encrypt, isEncrypted } = require('../../utils/encryption');

module.exports = {
    async up(queryInterface) {
        const encryptionKey = process.env.DB_ENCRYPTION_KEY;
        if (!encryptionKey) {
            throw new Error(
                'DB_ENCRYPTION_KEY must be set before running the user encryption data migration'
            );
        }

        const transaction = await queryInterface.sequelize.transaction();
        try {
            const users = await queryInterface.sequelize.query(
                `SELECT id, "firstName", "lastName", email, "initialPassword", "twoFactorOtp", "totpSecret", "orcidId", "ldapUsername", "samlNameId", "salt" FROM "user"`,
                { type: queryInterface.sequelize.QueryTypes.SELECT, transaction }
            );

            for (const user of users) {
                const updates = {};

                if (user.firstName) {
                    updates.firstName = encrypt(user.firstName);
                }
                if (user.lastName) {
                    updates.lastName = encrypt(user.lastName);
                }
                if (user.email) {
                    const encryptedEmail = encrypt(user.email);
                    updates.email = encryptedEmail;
                }
                if (user.initialPassword) {
                    updates.initialPassword = encrypt(user.initialPassword);
                }
                if (user.twoFactorOtp) {
                    updates.twoFactorOtp = encrypt(user.twoFactorOtp);
                }
                if (user.totpSecret) {
                    updates.totpSecret = encrypt(user.totpSecret);
                }
                if (user.orcidId) {
                    updates.orcidId = encrypt(user.orcidId);
                }
                if (user.ldapUsername) {
                    updates.ldapUsername = encrypt(user.ldapUsername);
                }
                if (user.samlNameId) {
                    updates.samlNameId = encrypt(user.samlNameId);
                }
                if (user.salt) {
                    updates.salt = encrypt(user.salt);
                }

                if (Object.keys(updates).length > 0) {
                    const setClauses = Object.keys(updates)
                        .map(col => `"${col}" = :${col}`)
                        .join(', ');

                    await queryInterface.sequelize.query(
                        `UPDATE "user" SET ${setClauses} WHERE id = :id`,
                        {
                            replacements: { ...updates, id: user.id },
                            transaction,
                        }
                    );
                }
            }

            await transaction.commit();
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    },

    async down(queryInterface) {
        // Reversing this migration would require decrypting all rows.
        // Use the DB_ENCRYPTION_KEY to manually decrypt if needed.
        // This down() is intentionally a no-op to avoid accidental data loss.
        console.warn(
            '[down] 20260612100001-encrypt-user-fields: ' +
            'This migration cannot be automatically reversed. ' +
            'Decrypt rows manually using the encryption key if needed.'
        );
    },
};
