'use strict';

/**
 * Shared helper for creating the first admin account, used by the wizard route
 * (POST /auth/setup-admin) and the dev admin setup (see devAdmin.js).
 */

/**
 * Build a validation error tagged with statusCode=400 so HTTP callers can map it
 * to a client error without inspecting the message.
 * @param {string} message
 * @returns {Error}
 */
function validationError(message) {
    const err = new Error(message);
    err.statusCode = 400;
    return err;
}

/**
 * Create the first admin account and reassign the 5 Exposé configurations from
 * Bot (userId=2) to the new admin in a single transaction.
 *
 * @param {Server} server main server instance
 * @param {{userName: string, email: string, password: string}} input
 * @returns {Promise<object>} created user
 */
async function createInitialAdmin(server, { userName, email, password }) {
    if (!userName || (typeof userName === 'string' && !userName.trim())) {
        throw validationError('Please provide a user name.');
    }
    const existingByName = await server.db.models['user'].getUserIdByName(userName);
    if (existingByName !== 0) {
        throw validationError('Username already taken.');
    }

    if (!email || (typeof email === 'string' && !email.trim())) {
        throw validationError('Please provide an email.');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw validationError('Please provide a valid email.');
    }
    const existingByEmail = await server.db.models['user'].getUserIdByEmail(email);
    if (existingByEmail !== 0) {
        throw validationError('E-Mail already taken.');
    }

    if (!password || (typeof password === 'string' && password.length < 8)) {
        throw validationError('Password does not meet requirements (min 8 characters).');
    }

    const User = server.db.models['user'];
    const Configuration = server.db.models['configuration'];
    const { Op } = server.db.Sequelize;

    const EXPOSE_CONFIG_NAMES = [
        'Exposé assessment configuration',
        'Exposé feedback configuration',
        'UKP Exposé Submission Validator',
        'Exposé assessment configuration (German)',
        'Exposé feedback configuration (German)',
    ];
    const BOT_USER_ID = 2;

    const transaction = await User.sequelize.transaction();
    try {
        const user = await User.add(
            {
                userName: userName.trim(),
                email: email.trim(),
                password,
                firstName: userName.trim(),
                lastName: 'User',
                acceptTerms: true,
                acceptStats: true,
                emailVerified: true,
            },
            { transaction, context: { userRoles: 'admin' } }
        );

        await Configuration.update(
            { userId: user.id },
            {
                where: {
                    name: { [Op.in]: EXPOSE_CONFIG_NAMES },
                    userId: BOT_USER_ID,
                },
                transaction,
            }
        );

        await transaction.commit();
        return user;
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
}

module.exports = { createInitialAdmin };
