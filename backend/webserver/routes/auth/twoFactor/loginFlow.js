'use strict';

const { TOTP } = require('otpauth');

/**
 * Register login-time 2FA routes: method selection, verification, cooldown state,
 * and OTP resend.
 *
 * @param {Server} server main server instance
 * @param {{shared: Object, twoFactor: Object}} helpers
 */
function registerTwoFactorLoginFlowRoutes(server, helpers) {
    const { shared, twoFactor } = helpers;

    /**
     * Select the 2FA method to use when multiple methods are enabled.
     */
    server.app.post('/auth/2fa/select', async (req, res) => {
        const { method } = req.body;

        if (!req.session || !req.session.twoFactorPending) {
            return res.status(400).json({ message: 'No pending 2FA verification found. Please login again.' });
        }

        const pending = req.session.twoFactorPending;
        if (!method || !pending.methods || !Array.isArray(pending.methods)) {
            return res.status(400).json({ message: 'Missing 2FA method selection.' });
        }
        if (!pending.methods.includes(method)) {
            return res.status(400).json({ message: 'Selected 2FA method is not enabled for this user.' });
        }

        const userRecord = await server.db.models['user'].findOne({
            where: { id: pending.userId },
            raw: true,
        });
        if (!userRecord) {
            delete req.session.twoFactorPending;
            return res.status(400).json({ message: 'User not found.' });
        }

        pending.method = method;
        pending.failedAttempts = 0;
        req.session.twoFactorPending = pending;

        try {
            if (method === 'email') {
                if (!userRecord.email) {
                    return res.status(400).json({ message: 'Email address not found. Cannot use email 2FA.' });
                }
                await twoFactor.sendEmailOtp(userRecord);
                twoFactor.resetTwoFactorFailedAttempts(pending);
                const cooldownInfo = twoFactor.setEmailOtpCooldown(pending);
                return req.session.save(() => res.status(200).json({ requiresTwoFactor: true, method: 'email', ...cooldownInfo }));
            }

            if (method === 'totp') {
                if (!userRecord.totpSecret) {
                    return res.status(400).json({ message: 'TOTP is enabled but not configured (missing secret).' });
                }
                return req.session.save(() => res.status(200).json({ requiresTwoFactor: true, method: 'totp' }));
            }

            return res.status(400).json({ message: `Unsupported 2FA method: ${method}` });
        } catch (error) {
            server.logger.error('Failed to apply 2FA selection: ' + error);
            return res.status(500).json({ message: 'Failed to start selected 2FA method.' });
        }
    });

    /**
     * Verify an email OTP and complete login.
     */
    server.app.post('/auth/2fa/email/verify', async (req, res) => {
        const { otp } = req.body;
        if (!otp) {
            return res.status(400).json({ message: 'OTP is required.' });
        }
        if (!req.session || !req.session.twoFactorPending) {
            return res.status(400).json({ message: 'No pending 2FA verification found. Please login again.' });
        }
        if (req.session.twoFactorPending.method !== 'email') {
            return res.status(400).json({ message: 'Email 2FA is not the selected method.' });
        }

        try {
            const pending = req.session.twoFactorPending;
            const user = await server.db.models['user'].findOne({
                where: { id: pending.userId },
            });

            if (!user) {
                delete req.session.twoFactorPending;
                return res.status(400).json({ message: 'User not found.' });
            }

            if (!user.twoFactorOtp || user.twoFactorOtp !== otp) {
                return await twoFactor.handleFailedTwoFactorAttempt(req, res, {
                    userId: user.id,
                    clearEmailOtp: true,
                    errorMessage: 'Invalid OTP code.',
                    tooManyAttemptsErrorMessage: 'Too many invalid OTP attempts. Please login again.',
                });
            }

            if (!user.twoFactorOtpExpiresAt || new Date() > new Date(user.twoFactorOtpExpiresAt)) {
                await server.db.models['user'].update(
                    { twoFactorOtp: null, twoFactorOtpExpiresAt: null },
                    { where: { id: user.id } }
                );
                delete req.session.twoFactorPending;
                return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
            }

            await server.db.models['user'].update(
                { twoFactorOtp: null, twoFactorOtpExpiresAt: null },
                { where: { id: user.id } }
            );

            shared.addLoginMethod(user, pending.loginMethod);
            return shared.finalizeLogin(req, res, user, { mode: 'json' });
        } catch (error) {
            server.logger.error('Failed to verify OTP: ' + error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    });

    /**
     * Return current resend cooldown state for email-based 2FA.
     */
    server.app.get('/auth/2fa/email/status', async (req, res) => {
        const pending = req.session?.twoFactorPending;
        if (!pending) {
            return res.status(400).json({ message: 'No pending 2FA verification found. Please login again.' });
        }
        if (pending.method !== 'email') {
            return res.status(400).json({ message: 'Email 2FA is not the selected method.' });
        }

        return res.status(200).json(twoFactor.getEmailOtpCooldownInfo(pending));
    });

    /**
     * Resend the email OTP for the current pending 2FA session.
     */
    server.app.post('/auth/2fa/otp/resend', twoFactor.resendEmailOtp);

    /**
     * Verify a TOTP code and complete login.
     */
    server.app.post('/auth/2fa/totp/verify', async (req, res, next) => {
        const token = String(req.body.token || '').replace(/\s/g, '');
        if (!token) {
            return res.status(400).json({ message: 'TOTP token is required.' });
        }

        const pending = req.session?.twoFactorPending;
        if (!pending?.userId) {
            return res.status(401).json({ message: 'Invalid TOTP code' });
        }

        try {
            const user = await server.db.models['user'].findOne({
                where: { id: pending.userId },
                raw: true,
            });
            if (!user || !user.totpSecret) {
                // If the user no longer has a TOTP secret, the pending login state is invalid.
                delete req.session.twoFactorPending;
                return req.session.save((saveErr) => {
                    if (saveErr) {
                        server.logger.error('Failed to save session: ' + saveErr);
                        return res.status(500).json({ message: 'Session error during 2FA.' });
                    }

                    return res.status(401).json({ message: 'Invalid TOTP code' });
                });
            }

            const totp = new TOTP({ secret: user.totpSecret, digits: 6, period: 30 });
            if (totp.validate({ token, window: 1 }) === null) {
                return await twoFactor.handleFailedTwoFactorAttempt(req, res, {
                    errorMessage: 'Invalid TOTP code.',
                    tooManyAttemptsErrorMessage: 'Too many invalid TOTP attempts. Please login again.',
                });
            }

            shared.addLoginMethod(user, pending.loginMethod);
            return shared.finalizeLogin(req, res, user, { mode: 'json' });
        } catch (err) {
            return next(err);
        }
    });
}

module.exports = {
    registerTwoFactorLoginFlowRoutes,
};
