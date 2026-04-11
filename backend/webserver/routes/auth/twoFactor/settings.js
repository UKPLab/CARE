'use strict';

const { Secret, TOTP } = require('otpauth');

/**
 * Register account-level 2FA settings routes.
 *
 * @param {Server} server main server instance
 * @param {{shared: Object, twoFactor: Object}} helpers
 */
function registerTwoFactorSettingsRoutes(server, helpers) {
    const { shared, twoFactor } = helpers;

    /**
     * Start TOTP setup for the authenticated user by generating a new secret and
     * storing it temporarily in the session until verification succeeds.
     */
    server.app.post('/auth/2fa/totp/setup/initiate', shared.ensureAuthenticated, async (req, res) => {
        const user = await server.db.models['user'].findOne({ where: { id: req.user.id }, raw: true });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const secret = new Secret({ size: 20 });
        const secretBase32 = secret.base32;
        const totp = new TOTP({
            issuer: 'CARE',
            label: `CARE (${user.userName})`,
            secret,
            digits: 6,
            period: 30,
        });

        req.session.totpSetupPending = { secretBase32 };
        return req.session.save((err) => {
            if (err) {
                server.logger.error('Failed to save session for TOTP setup: ' + err);
                return res.status(500).json({ message: 'Failed to initiate TOTP setup.' });
            }
            return res.status(200).json({
                otpauthUrl: totp.toString(),
                secretBase32,
            });
        });
    });

    /**
     * Verify the first TOTP code for a pending setup and persist the secret.
     */
    server.app.post('/auth/2fa/totp/setup/verify', shared.ensureAuthenticated, async (req, res, next) => {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ message: 'TOTP token is required.' });
        }
        if (!req.session?.totpSetupPending?.secretBase32) {
            return res.status(400).json({ message: 'No pending TOTP setup found.' });
        }

        const secretBase32 = req.session.totpSetupPending.secretBase32;
        const totp = new TOTP({ secret: secretBase32, digits: 6, period: 30 });
        if (totp.validate({ token: String(token).trim(), window: 1 }) === null) {
            return res.status(401).json({ message: 'Invalid TOTP code.' });
        }

        try {
            const dbUser = await server.db.models['user'].findOne({
                where: { id: req.user.id },
            });
            if (!dbUser) {
                return res.status(404).json({ message: 'User not found.' });
            }

            const currentMethods = Array.isArray(dbUser.twoFactorMethods) ? [...dbUser.twoFactorMethods] : [];
            if (!currentMethods.includes('totp')) {
                currentMethods.push('totp');
            }

            await server.db.models['user'].update(
                {
                    totpSecret: secretBase32,
                    twoFactorMethods: currentMethods,
                },
                { where: { id: dbUser.id } }
            );

            delete req.session.totpSetupPending;

            return res.status(200).json({
                message: 'TOTP configured successfully.',
                twoFactorMethods: currentMethods,
            });
        } catch (err) {
            return next(err);
        }
    });

    /**
     * Return the authenticated user's current 2FA status.
     */
    server.app.get('/auth/2fa/status', async (req, res) => {
        if (!req.user) {
            return res.status(401).json({ message: 'You must be logged in to check 2FA status.' });
        }

        try {
            const user = await server.db.models['user'].findOne({
                where: { id: req.user.id },
                attributes: ['twoFactorMethods', 'totpSecret', 'email', 'orcidId'],
            });
            if (!user) {
                return res.status(404).json({ message: 'User not found.' });
            }

            const methods = twoFactor.getTwoFactorMethods(user);
            const hasTotp = methods.includes('totp') && !!user.totpSecret;

            return res.status(200).json({
                twoFactorMethods: methods,
                hasEmail: methods.includes('email'),
                hasTotp,
                email: user.email || null,
                orcidId: user.orcidId || null,
            });
        } catch (error) {
            server.logger.error('Failed to get 2FA status: ' + error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    });

    /**
     * Enable a 2FA method for the authenticated user.
     */
    server.app.post('/auth/2fa/enable', async (req, res) => {
        if (!req.user) {
            return res.status(401).json({ message: 'You must be logged in to enable 2FA.' });
        }

        const { method } = req.body;
        if (!method || !['email', 'totp'].includes(method)) {
            return res.status(400).json({ message: 'Valid 2FA method is required (email or totp).' });
        }

        try {
            const user = await server.db.models['user'].findOne({
                where: { id: req.user.id },
            });
            if (!user) {
                return res.status(404).json({ message: 'User not found.' });
            }
            if (method === 'email' && !user.email) {
                return res.status(400).json({ message: 'Email address is required to enable email 2FA.' });
            }
            if (method === 'totp') {
                return res.status(400).json({ message: 'Use /auth/2fa/totp/setup/initiate and /auth/2fa/totp/setup/verify to enable TOTP (requires setup + verification).' });
            }

            const currentMethods = Array.isArray(user.twoFactorMethods) ? user.twoFactorMethods.slice() : [];
            if (!currentMethods.includes(method)) {
                currentMethods.push(method);
            }

            await server.db.models['user'].update(
                { twoFactorMethods: currentMethods },
                { where: { id: user.id } }
            );

            return res.status(200).json({
                message: `2FA has been enabled with ${method} method.`,
                twoFactorMethods: currentMethods,
            });
        } catch (error) {
            server.logger.error('Failed to enable 2FA: ' + error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    });

    /**
     * Disable a specific 2FA method for the authenticated user and clean up
     * provider-specific state where required.
     */
    server.app.post('/auth/2fa/disable/:method', shared.ensureAuthenticated, async (req, res) => {
        const method = req.params.method;
        if (!['email', 'totp'].includes(method)) {
            return res.status(400).json({ message: 'Valid 2FA method is required (email or totp).' });
        }

        try {
            const user = await server.db.models['user'].findOne({
                where: { id: req.user.id },
            });
            if (!user) {
                return res.status(404).json({ message: 'User not found.' });
            }

            const currentMethods = twoFactor.getTwoFactorMethods(user);
            if (!currentMethods.includes(method)) {
                return res.status(400).json({ message: `2FA method '${method}' is not enabled for this user.` });
            }

            const updatedMethods = currentMethods.filter((entry) => entry !== method);
            const updateData = { twoFactorMethods: updatedMethods };

            if (method === 'email') {
                updateData.twoFactorOtp = null;
                updateData.twoFactorOtpExpiresAt = null;
            }
            if (method === 'totp') {
                updateData.totpSecret = null;
            }
            if (updatedMethods.length === 0) {
                updateData.twoFactorOtp = null;
                updateData.twoFactorOtpExpiresAt = null;
                updateData.totpSecret = null;
            }

            await server.db.models['user'].update(updateData, { where: { id: user.id } });

            return res.status(200).json({
                message: `2FA method '${method}' has been disabled.`,
                twoFactorMethods: updatedMethods,
            });
        } catch (error) {
            server.logger.error('Failed to disable 2FA method: ' + error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    });
}

module.exports = {
    registerTwoFactorSettingsRoutes,
};
