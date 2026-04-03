'use strict';

const crypto = require('crypto');

/**
 * Build shared helpers for login-time and account-level 2FA workflows.
 *
 * @param {Server} server main server instance
 * @param {Object} sharedHelpers
 * @param {Object} emailHelpers
 * @returns {Object} 2FA helpers
 */
function createTwoFactorHelpers(server, sharedHelpers, emailHelpers) {
    const EMAIL_2FA_RESEND_COOLDOWN_MS = 60 * 1000;
    const MAX_2FA_VERIFY_ATTEMPTS = 5;

    /**
     * Read enabled 2FA methods from a user record.
     *
     * @param {Object} user
     * @returns {string[]}
     */
    function getTwoFactorMethods(user) {
        if (!user) return [];
        if (Array.isArray(user.twoFactorMethods)) {
            return user.twoFactorMethods.filter((method) => !!method);
        }
        return [];
    }

    /**
     * Compute the current resend cooldown state for email OTP.
     *
     * @param {Object} pending
     * @returns {{cooldownUntil: number, retryAfterSeconds: number, canResend: boolean}}
     */
    function getEmailOtpCooldownInfo(pending) {
        const cooldownUntil = Number(pending?.resendCooldownUntil || 0);
        const retryAfterSeconds = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));

        return {
            cooldownUntil,
            retryAfterSeconds,
            canResend: retryAfterSeconds === 0,
        };
    }

    /**
     * Start or renew the resend cooldown window for email OTP.
     *
     * @param {Object} pending
     * @param {number} durationMs
     * @returns {{cooldownUntil: number, retryAfterSeconds: number, canResend: boolean}}
     */
    function setEmailOtpCooldown(pending, durationMs = EMAIL_2FA_RESEND_COOLDOWN_MS) {
        pending.resendCooldownUntil = Date.now() + durationMs;
        return getEmailOtpCooldownInfo(pending);
    }

    /**
     * Return the number of remaining verification attempts for the active 2FA session.
     *
     * @param {Object} pending
     * @returns {number}
     */
    function getTwoFactorAttemptsRemaining(pending) {
        const failedAttempts = Number(pending?.failedAttempts || 0);
        return Math.max(0, MAX_2FA_VERIFY_ATTEMPTS - failedAttempts);
    }

    /**
     * Reset the failed-attempt counter for the current 2FA session.
     *
     * @param {Object} pending
     * @returns {Object}
     */
    function resetTwoFactorFailedAttempts(pending) {
        pending.failedAttempts = 0;
        return pending;
    }

    /**
     * Handle a failed 2FA verification attempt, including attempt counting and optional
     * invalidation of stored email OTP state.
     *
     * @param {Object} req
     * @param {Object} res
     * @param {Object} options
     * @returns {Promise<*>}
     */
    async function handleFailedTwoFactorAttempt(req, res, options = {}) {
        const {
            userId = null,
            clearEmailOtp = false,
            errorMessage = 'Invalid verification code.',
            tooManyAttemptsErrorMessage = 'Too many invalid verification attempts. Please login again.',
        } = options;

        const pending = req.session?.twoFactorPending;
        if (!pending) {
            return res.status(400).json({ message: 'No pending 2FA verification found. Please login again.' });
        }

        pending.failedAttempts = Number(pending.failedAttempts || 0) + 1;
        const attemptsRemaining = getTwoFactorAttemptsRemaining(pending);

        if (attemptsRemaining === 0) {
            if (clearEmailOtp && userId) {
                await server.db.models['user'].update(
                    { twoFactorOtp: null, twoFactorOtpExpiresAt: null },
                    { where: { id: userId } }
                );
            }

            delete req.session.twoFactorPending;

            return req.session.save((err) => {
                if (err) {
                    server.logger.error('Failed to save session: ' + err);
                    return res.status(500).json({ message: 'Session error during 2FA.' });
                }

                return res.status(429).json({
                    message: tooManyAttemptsErrorMessage,
                    attemptsRemaining: 0,
                    maxAttempts: MAX_2FA_VERIFY_ATTEMPTS,
                });
            });
        }

        req.session.twoFactorPending = pending;

        return req.session.save((err) => {
            if (err) {
                server.logger.error('Failed to save session: ' + err);
                return res.status(500).json({ message: 'Session error during 2FA.' });
            }

            return res.status(401).json({
                message: `${errorMessage} ${attemptsRemaining} attempt(s) remaining.`,
                attemptsRemaining,
                maxAttempts: MAX_2FA_VERIFY_ATTEMPTS,
            });
        });
    }

    /**
     * Generate, store, and deliver an email OTP for email-based 2FA.
     *
     * @param {Object} userRecord
     * @returns {Promise<void>}
     */
    async function sendEmailOtp(userRecord) {
        if (!userRecord || !userRecord.email) {
            throw new Error('Email address missing for email 2FA.');
        }

        const otp = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await server.db.models['user'].update(
            {
                twoFactorOtp: otp,
                twoFactorOtpExpiresAt: otpExpiresAt,
            },
            { where: { id: userRecord.id } }
        );

        // Template resolution stays centralized in the email helper; this function only
        // owns OTP generation, persistence, and dispatch.
        const emailContent = await emailHelpers.getEmailContent(
            'email.template.twoFactorOtp',
            'twoFactorOtp',
            {
                userId: userRecord.id,
                userName: userRecord.userName,
                otp,
                tokenExpiry: 10,
            }
        );

        await server.sendMail(
            userRecord.email,
            emailContent.subject,
            emailContent.body,
            { isHtml: emailContent.isHtml }
        );
    }

    /**
     * Resend the current user's email OTP if cooldown and account settings allow it.
     *
     * @param {Object} req
     * @param {Object} res
     * @returns {Promise<*>}
     */
    async function resendEmailOtp(req, res) {
        if (!req.session || !req.session.twoFactorPending) {
            return res.status(400).json({ message: 'No pending 2FA verification found. Please login again.' });
        }
        if (req.session.twoFactorPending.method !== 'email') {
            return res.status(400).json({ message: 'Email 2FA is not the selected method. Please select email first.' });
        }

        try {
            const pending = req.session.twoFactorPending;
            const cooldownInfo = getEmailOtpCooldownInfo(pending);

            if (!cooldownInfo.canResend) {
                return res.status(429).json({
                    message: 'Please wait before requesting another code.',
                    ...cooldownInfo,
                });
            }

            const user = await server.db.models['user'].findOne({
                where: { id: pending.userId },
            });
            const methods = getTwoFactorMethods(user);

            if (!user || !methods.includes('email')) {
                delete req.session.twoFactorPending;
                return res.status(400).json({ message: 'Email 2FA is not enabled for this user.' });
            }

            if (!user.email) {
                return res.status(400).json({ message: 'User email not found. Cannot send OTP.' });
            }

            await sendEmailOtp(user);
            resetTwoFactorFailedAttempts(pending);
            const nextCooldownInfo = setEmailOtpCooldown(pending);

            return req.session.save((err) => {
                if (err) {
                    server.logger.error('Failed to save session: ' + err);
                    return res.status(500).json({ message: 'Session error during 2FA.' });
                }

                return res.status(200).json({
                    message: 'OTP has been sent to your email address.',
                    expiresIn: 10,
                    ...nextCooldownInfo,
                });
            });
        } catch (error) {
            server.logger.error('Failed to request OTP: ' + error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }

    /**
     * Perform the side effect needed to start a specific 2FA method.
     *
     * @param {Object} user
     * @param {'email'|'totp'} method
     * @returns {Promise<void>}
     */
    async function performTwoFactorAction(user, method) {
        if (method === 'email') {
            if (!user.email) {
                throw { status: 400, message: 'Email not found for this user.' };
            }
            await sendEmailOtp(user);
            return;
        }

        if (method === 'totp') {
            if (!user.totpSecret) {
                throw { status: 400, message: 'TOTP is not configured.' };
            }
            return;
        }

        throw { status: 400, message: `Unsupported 2FA method: ${method}` };
    }

    /**
     * Map a 2FA method to the frontend verification route.
     *
     * @param {'email'|'totp'} method
     * @returns {string}
     */
    function getTwoFactorRedirectPath(method) {
        const paths = {
            email: '/2fa/verify/email',
            totp: '/2fa/verify/totp',
        };
        return paths[method] || '/login?error=unsupported-method';
    }

    /**
     * Start the login-time 2FA flow by creating pending session state and returning
     * either JSON or a frontend redirect.
     *
     * @param {Object} req
     * @param {Object} res
     * @param {number|string} userId
     * @param {{mode?: 'json'|'redirect', loginMethod?: string}} options
     * @returns {Promise<boolean>}
     */
    async function startTwoFactorLogin(req, res, userId, options = { mode: 'json', loginMethod: null }) {
        const mode = options.mode || 'json';
        const loginMethod = options.loginMethod || null;

        // 1.Get user record and 2fa methods
        const dbUser = await server.db.models['user'].findByPk(userId, { raw: true });
        if (!dbUser) return false;

        const methods = getTwoFactorMethods(dbUser);
        if (!methods || methods.length === 0) return false;

        // 2. Initialize 2FA Session
        req.session.twoFactorPending = {
            userId: dbUser.id,
            methods,
            method: null,
            loginMethod,
            failedAttempts: 0,
        };

        const responseData = { requiresTwoFactor: true, methods };
        let redirectPath = '/2fa/select';

        // 3. Handle single method vs multiple methods
        if (methods.length === 1) {
            const method = methods[0];
            req.session.twoFactorPending.method = method;

            try {
                // Execute 2fa relevant operation
                await performTwoFactorAction(dbUser, method);

                if (method === 'email') {
                    const cooldownInfo = setEmailOtpCooldown(req.session.twoFactorPending);
                    resetTwoFactorFailedAttempts(req.session.twoFactorPending);
                    Object.assign(responseData, cooldownInfo);
                }

                // Set results for a single 2FA method
                responseData.selectionRequired = false;
                responseData.method = method;
                redirectPath = getTwoFactorRedirectPath(method);
            } catch (error) {
                server.logger.error(`2FA Initialization failed: ${error.message}`);
                return res.status(error.status || 500).json({ message: error.message });
            }
        } else {
            // Multiple methods available; requiring frontend to display selection page
            responseData.selectionRequired = true;
        }

        // 4. Unified handling of session persistence and response
        const frontendBaseUrl = mode === 'redirect' ? await sharedHelpers.getFrontendBaseUrl() : null;
        req.session.save((err) => {
            if (err) {
                server.logger.error('Failed to save session: ' + err);
                return res.status(500).json({ message: 'Session error during 2FA.' });
            }

            if (mode === 'redirect') {
                // External provider flows hand control back to the frontend.
                return res.redirect(sharedHelpers.buildFrontendUrl(frontendBaseUrl, redirectPath));
            }

            return res.status(200).json(responseData);
        });

        return true;
    }

    return {
        getEmailOtpCooldownInfo,
        getTwoFactorMethods,
        handleFailedTwoFactorAttempt,
        resendEmailOtp,
        resetTwoFactorFailedAttempts,
        sendEmailOtp,
        setEmailOtpCooldown,
        startTwoFactorLogin,
    };
}

module.exports = {
    createTwoFactorHelpers,
};
