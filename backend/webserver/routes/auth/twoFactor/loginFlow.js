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
            return res.status(400).json({ message: 'auth.twoFactor.api.noPendingVerification' });
        }

        const pending = req.session.twoFactorPending;
        if (!method || !pending.methods || !Array.isArray(pending.methods)) {
            return res.status(400).json({ message: 'auth.twoFactor.api.missingMethodSelection' });
        }
        if (!pending.methods.includes(method)) {
            return res.status(400).json({ message: 'auth.twoFactor.api.selectedMethodNotEnabled' });
        }

        const userRecord = await server.db.models['user'].findOne({
            where: { id: pending.userId },
            raw: true,
        });
        if (!userRecord) {
            delete req.session.twoFactorPending;
            return res.status(400).json({ message: 'auth.twoFactor.api.userNotFound' });
        }

        pending.method = method;
        pending.failedAttempts = 0;
        req.session.twoFactorPending = pending;

        try {
            if (method === 'email') {
                if (!userRecord.email) {
                    return res.status(400).json({ message: 'auth.twoFactor.api.emailAddressNotFound' });
                }
                await twoFactor.sendEmailOtp(userRecord);
                twoFactor.resetTwoFactorFailedAttempts(pending);
                const cooldownInfo = twoFactor.setEmailOtpCooldown(pending);
                return req.session.save(() => res.status(200).json({ requiresTwoFactor: true, method: 'email', ...cooldownInfo }));
            }

            if (method === 'totp') {
                if (!userRecord.totpSecret) {
                    return res.status(400).json({ message: 'auth.twoFactor.api.totpMissingSecret' });
                }
                return req.session.save(() => res.status(200).json({ requiresTwoFactor: true, method: 'totp' }));
            }

            return res.status(400).json({ message: 'auth.twoFactor.api.unsupportedMethod', params: { method } });
        } catch (error) {
            server.logger.error('Failed to apply 2FA selection: ' + error);
            return res.status(500).json({ message: 'auth.twoFactor.api.startSelectedMethodFailed' });
        }
    });

    /**
     * Verify an email OTP and complete login.
     */
    server.app.post('/auth/2fa/email/verify', async (req, res) => {
        const { otp } = req.body;
        if (!otp) {
            return res.status(400).json({ message: 'auth.twoFactor.api.otpRequired' });
        }
        if (!req.session || !req.session.twoFactorPending) {
            return res.status(400).json({ message: 'auth.twoFactor.api.noPendingVerification' });
        }
        if (req.session.twoFactorPending.method !== 'email') {
            return res.status(400).json({ message: 'auth.twoFactor.api.emailNotSelected' });
        }

        try {
            const pending = req.session.twoFactorPending;
            const user = await server.db.models['user'].findOne({
                where: { id: pending.userId },
            });

            if (!user) {
                delete req.session.twoFactorPending;
                return res.status(400).json({ message: 'auth.twoFactor.api.userNotFound' });
            }

            if (!user.twoFactorOtp || user.twoFactorOtp !== otp) {
                return await twoFactor.handleFailedTwoFactorAttempt(req, res, {
                    userId: user.id,
                    clearEmailOtp: true,
                    errorMessage: 'auth.twoFactor.api.invalidOtpAttemptsRemaining',
                    tooManyAttemptsErrorMessage: 'auth.twoFactor.api.tooManyInvalidOtpAttempts',
                });
            }

            if (!user.twoFactorOtpExpiresAt || new Date() > new Date(user.twoFactorOtpExpiresAt)) {
                await server.db.models['user'].update(
                    { twoFactorOtp: null, twoFactorOtpExpiresAt: null },
                    { where: { id: user.id } }
                );
                delete req.session.twoFactorPending;
                return res.status(400).json({ message: 'auth.twoFactor.api.otpExpired' });
            }

            await server.db.models['user'].update(
                { twoFactorOtp: null, twoFactorOtpExpiresAt: null },
                { where: { id: user.id } }
            );

            shared.addLoginMethod(user, pending.loginMethod);
            return shared.finalizeLogin(req, res, user, { mode: 'json' });
        } catch (error) {
            server.logger.error('Failed to verify OTP: ' + error);
            return res.status(500).json({ message: 'auth.twoFactor.api.internalServerError' });
        }
    });

    /**
     * Return current resend cooldown state for email-based 2FA.
     */
    server.app.get('/auth/2fa/email/status', async (req, res) => {
        const pending = req.session?.twoFactorPending;
        if (!pending) {
            return res.status(400).json({ message: 'auth.twoFactor.api.noPendingVerification' });
        }
        if (pending.method !== 'email') {
            return res.status(400).json({ message: 'auth.twoFactor.api.emailNotSelected' });
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
            return res.status(400).json({ message: 'auth.twoFactor.api.totpTokenRequired' });
        }

        const pending = req.session?.twoFactorPending;
        if (!pending?.userId) {
            return res.status(401).json({ message: 'auth.twoFactor.api.invalidTotpCodeNoPeriod' });
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
                        return res.status(500).json({ message: 'auth.twoFactor.api.sessionErrorDuring2fa' });
                    }

                    return res.status(401).json({ message: 'auth.twoFactor.api.invalidTotpCodeNoPeriod' });
                });
            }

            const totp = new TOTP({ secret: user.totpSecret, digits: 6, period: 30 });
            if (totp.validate({ token, window: 1 }) === null) {
                return await twoFactor.handleFailedTwoFactorAttempt(req, res, {
                    errorMessage: 'auth.twoFactor.api.invalidTotpAttemptsRemaining',
                    tooManyAttemptsErrorMessage: 'auth.twoFactor.api.tooManyInvalidTotpAttempts',
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
