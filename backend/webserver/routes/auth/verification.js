'use strict';

const { decodeToken, generateToken } = require('../../../utils/auth');

/**
 * Register email verification routes.
 *
 * @param {Server} server main server instance
 * @param {{email: Object}} helpers
 */
function registerVerificationRoutes(server, helpers) {
    const { email } = helpers;

    /**
     * Verify a registration email token and mark the account as verified.
     */
    server.app.get('/verify-email', async (req, res) => {
        const { token } = req.query;

        if (String(await server.db.models['setting'].get('app.register.emailVerification')) !== 'true') {
            return res.status(400).send({ message: 'Email verification is disabled.' });
        }
        if (!token) {
            return res.status(400).send({ message: 'Missing token.' });
        }

        try {
            // Decode and validate token
            const decoded = decodeToken(token);
            if (!decoded.isValid) {
                return res.status(400).send({ message: 'Invalid token format.' });
            }
            if (decoded.expired) {
                return res.status(400).send({ message: 'Token has expired.' });
            }

            // Find user by verification token
            const user = await server.db.models['user'].findOne({ where: { emailVerificationToken: token } });
            if (!user) {
                return res.status(400).send({ message: 'Invalid token.' });
            }

            // Mark email as verified and clear token
            await server.db.models['user'].update(
                { emailVerified: true, emailVerificationToken: null },
                { where: { id: user.id } }
            );
            return res.status(200).send({ message: 'Email successfully verified. You can now log in.' });
        } catch (error) {
            server.logger.error('Failed to verify email:', error);
            return res.status(500).send({ message: 'Internal server error' });
        }
    });

    /**
     * Resend a verification email if the user is still unverified and not rate-limited.
     */
    server.app.post('/auth/resend-verification', async (req, res) => {
        const { email: userEmail } = req.body;
        if (!userEmail) {
            return res.status(400).json({ message: 'Email address is required.' });
        }

        try {
            // Check if email verification is enabled
            const emailVerificationEnabled = String(await server.db.models['setting'].get('app.register.emailVerification')) === 'true';
            if (!emailVerificationEnabled) {
                return res.status(400).json({ message: 'Email verification is disabled.' });
            }

            // Find user by email
            const user = await server.db.models['user'].findOne({ where: { email: userEmail } });
            if (!user) {
                return res.status(400).json({ message: 'User with this email does not exist.' });
            }

            // Check if already verified
            if (user.emailVerified) {
                return res.status(400).json({ message: 'Email address is already verified.' });
            }

            // Rate limiting: check if a verification email was sent recently
            const rateLimitMinutes = await email.getEmailVerificationRateLimit();
            const rateLimitCheck = email.checkEmailRateLimit(user, 'verification', rateLimitMinutes);
            if (!rateLimitCheck.allowed) {
                return res.status(400).json({
                    message: `Please wait ${rateLimitCheck.remainingTime} minute(s) before requesting another verification email.`,
                });
            }

            // Generate new verification token
            const tokenExpiry = await email.getEmailVerificationTokenExpiry();
            const verificationToken = generateToken(tokenExpiry);

            // Update user with new token and timestamp
            await server.db.models['user'].update(
                { emailVerificationToken: verificationToken, lastVerificationEmailSent: new Date() },
                { where: { id: user.id } }
            );

            // Send verification email
            const baseUrl = await email.getBaseUrl();
            const verificationLink = `http://${baseUrl}/login?token=${verificationToken}`;
            const emailContent = await email.getEmailContent(
                'email.template.verification',
                'verification',
                {
                    userId: user.id,
                    baseUrl,
                    link: verificationLink,
                    userName: user.userName,
                    tokenExpiry,
                }
            );

            await server.sendMail(
                userEmail,
                emailContent.subject,
                emailContent.body,
                { isHtml: emailContent.isHtml }
            );

            return res.status(200).json({ message: 'Verification email has been sent.' });
        } catch (error) {
            server.logger.error('Failed to resend verification email:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    });
}

module.exports = {
    registerVerificationRoutes,
};
