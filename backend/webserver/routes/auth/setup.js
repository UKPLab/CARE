'use strict';

const { relevantFields } = require('../../../utils/auth');
const { createInitialAdmin } = require('../../utils/setupAdmin');

/**
 * Register first-time setup routes.
 *
 * @param {Server} server main server instance
 */
function registerSetupRoutes(server) {
    /**
     * Create the first admin account (setup wizard step 1). Allowed only when no admin exists.
     * Reassigns the Exposé configurations from Bot to the new admin.
     */
    server.app.post('/auth/setup-admin', async function (req, res) {
        const { userName, email, password } = req.body || {};

        try {
            const admins = await server.db.models['user'].getUsersByRole('admin');
            if (admins.length > 0) {
                return res.status(403).json({ message: 'An admin account already exists.' });
            }

            let user;
            try {
                user = await createInitialAdmin(server, { userName, email, password });
            } catch (err) {
                if (err && err.statusCode === 400) {
                    return res.status(400).json({ message: err.message });
                }
                server.logger.error('Cannot create setup admin: ' + err);
                return res.status(400).json({ message: 'Failed to create admin.', error: err.message });
            }

            req.logIn(user, function (err) {
                if (err) {
                    server.logger.error('setup-admin logIn error: ' + err);
                    return res.status(500).json({ message: 'Failed to complete setup.' });
                }
                return res.status(200).json({ user: relevantFields(user) });
            });
        } catch (err) {
            server.logger.error('setup-admin error: ' + err);
            return res.status(500).json({ message: 'Internal server error.' });
        }
    });
}

module.exports = {
    registerSetupRoutes,
};
