'use strict';

const { decodeToken, generateToken } = require('../../auth/utils');

/**
 * Register password reset routes.
 *
 * @param {Server} server main server instance
 * @param {{email: Object}} helpers
 */
function registerPasswordRoutes(server, helpers) {
    const { email } = helpers;

    /**
     * Start password reset by issuing a reset token and sending the reset email.
     */
    server.app.post('/auth/request-password-reset', async (req, res) => {
        const { email: userEmail } = req.body;

        if (await server.db.models['setting'].get('app.login.forgotPassword') !== 'true') {
            return res.status(400).json({ message: 'auth.api.passwordResetDisabled' });
        }
        if (!userEmail) {
            return res.status(400).json({ message: 'auth.api.provideEmail' });
        }

        try {
            const user = await server.db.models['user'].findOne({ where: { email: userEmail } });
            if (!user) {
                return res.status(401).json({ message: 'auth.api.userNotFoundByEmail' });
            }

            // Rate limiting: check if a password reset email was sent recently
            const rateLimitMinutes = await email.getPasswordResetRateLimit();
            const rateLimitCheck = email.checkEmailRateLimit(user, 'passwordReset', rateLimitMinutes);
            if (!rateLimitCheck.allowed) {
                return res.status(400).json({
                    message: 'auth.api.passwordResetRateLimited',
                    params: { minutes: rateLimitCheck.remainingTime },
                });
            }

            // Generate token with encoded expiry from settings
            const tokenExpiry = await email.getPasswordResetTokenExpiry();
            const resetToken = generateToken(tokenExpiry);

            // Store the full token and timestamp in the database
            user.resetToken = resetToken;
            user.lastPasswordResetEmailSent = new Date();
            await user.save();

            // Send email with the full encoded token
            const baseUrl = await email.getBaseUrl();
            const resetLink = `http://${baseUrl}/reset-password?token=${resetToken}`;
            const emailContent = await email.getEmailContent(
                'email.template.passwordReset',
                'passwordReset',
                {
                    userId: user.id,
                    baseUrl,
                    link: resetLink,
                    userName: user.userName,
                    tokenExpiry,
                }
            );

            await server.sendMail(user.email, emailContent.subject, emailContent.body, { isHtml: emailContent.isHtml });
            return res.status(200).json({ message: 'auth.api.passwordResetLinkSent' });
        } catch (err) {
            server.logger.error('Failed to find user:', err);
            return res.status(500).json({ message: 'auth.api.internalServerError' });
        }
    });

    /**
     * Apply a password reset using a previously issued token.
     */
    server.app.post('/auth/reset-password', async (req, res) => {
        const { token, newPassword } = req.body;
        if (await server.db.models['setting'].get('app.login.forgotPassword') !== 'true') {
            return res.status(400).json({ message: 'auth.api.passwordResetDisabled' });
        }
        if (!token || !newPassword) {
            return res.status(400).json({ message: 'auth.api.tokenAndPasswordRequired' });
        }

        try {
            server.db.models['user'].validatePasswordContent(newPassword);
        } catch (err) {
            return res.status(400).json({ message: err.message });
        }

        try {
            // Decode the token and check expiry
            const decoded = decodeToken(token);
            if (!decoded.isValid) {
                return res.status(400).json({ message: 'auth.api.invalidTokenFormat' });
            }
            if (decoded.expired) {
                return res.status(400).json({ message: 'auth.api.tokenExpired' });
            }

            // Find user by the full token stored in database
            const user = await server.db.models['user'].findOne({ where: { resetToken: token } });
            if (!user) {
                return res.status(400).json({ message: 'auth.api.invalidToken' });
            }

            // Reset password and clear the reset token
            await server.db.models['user'].resetUserPwd(user.id, newPassword);
            await server.db.models['user'].update({ resetToken: null }, { where: { id: user.id } });

            const emailContent = await email.getEmailContent(
                'email.template.passwordResetSuccess',
                'passwordResetSuccess',
                {
                    userId: user.id,
                    userName: user.userName,
                }
            );

            await server.sendMail(
                user.email,
                emailContent.subject,
                emailContent.body,
                { isHtml: emailContent.isHtml }
            );
            return res.status(200).json({ message: 'auth.api.passwordResetSuccess' });
        } catch (err) {
            server.logger.error('Failed to reset password:', err);
            return res.status(500).json({ message: 'auth.api.internalServerError' });
        }
    });

    /**
     * Check whether a password reset token is still valid and present in the database.
     */
    server.app.get('/auth/check-reset-token', async (req, res) => {
        const { token } = req.query;
        if (!token) {
            return res.status(400).json({ message: 'auth.api.tokenRequired' });
        }

        try {
            // Decode and validate token format/expiry
            const decoded = decodeToken(token);
            if (!decoded.isValid) {
                return res.status(400).json({ message: 'auth.api.invalidTokenFormat' });
            }
            if (decoded.expired) {
                return res.status(400).json({ message: 'auth.api.tokenExpired' });
            }

            // Check if token exists in database
            const user = await server.db.models['user'].findOne({ where: { resetToken: token } });
            if (!user) {
                return res.status(404).json({ message: 'auth.api.tokenNotFound' });
            }

            return res.status(200).json({
                message: 'auth.api.tokenValid',
                expiryTime: decoded.expiryTime,
            });
        } catch (error) {
            server.logger.error('Failed to check reset token:', error);
            return res.status(500).json({ message: 'auth.api.internalServerError' });
        }
    });
}

module.exports = {
    registerPasswordRoutes,
};
