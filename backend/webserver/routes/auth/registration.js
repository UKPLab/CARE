'use strict';

const { generateToken } = require('../../auth/utils');

/**
 * Register self-registration routes.
 *
 * @param {Server} server main server instance
 * @param {{email: Object}} helpers
 */
function registerRegistrationRoutes(server, helpers) {
    const { email } = helpers;

    /**
     * Create a new local account and optionally send an email verification message.
     */
    server.app.post('/auth/register', async (req, res) => {
        const data = req.body;

        // Check if self-registration is enabled
        const isSelfRegistrationEnabled = await server.db.models['setting'].get('app.register.enabled');
        if (!isSelfRegistrationEnabled) {
            return res.status(403).json({ message: 'auth.api.selfRegistrationDisabled' });
        }

        // Check if name fields are required by settings
        if ((await server.db.models['setting'].get('app.register.requestName')) === 'true') {
            if (!data.firstName) {
                return res.status(400).json({ message: 'auth.api.provideFirstName' });
            }
            if (!data.lastName) {
                return res.status(400).json({ message: 'auth.api.provideLastName' });
            }
        }

        // Check if email is present and not already taken
        if (!data.email) {
            return res.status(400).json({ message: 'auth.api.provideAEmail' });
        }
        const emailUser = await server.db.models['user'].getUserIdByEmail(data.email);
        if (emailUser !== 0) {
            return res.status(400).json({ message: 'auth.api.emailAlreadyTaken' });
        }

        // Validate password presence and policy
        if (!data.password) {
            return res.status(400).json({ message: 'auth.api.providePassword' });
        }
        try {
            server.db.models['user'].validatePasswordContent(data.password);
        } catch (err) {
            return res.status(400).json({ message: err.message });
        }

        if (!data.acceptTerms && !data.isCreatedByAdmin) {
            return res.status(400).json({ message: 'auth.api.agreeToTerms' });
        }

        // Check if username is present and not already taken
        if (!data.userName) {
            return res.status(400).json({ message: 'auth.api.provideUserName' });
        }
        const userNameUser = await server.db.models['user'].getUserIdByName(data.userName);
        if (userNameUser !== 0) {
            server.logger.info('Username already taken: ' + data.userName);
            return res.status(400).json({ message: 'auth.api.usernameTaken' });
        }

        let transaction;
        try {
            transaction = await server.db.models['user'].sequelize.transaction();

            // Check if email verification is enabled
            const emailVerificationEnabled = String(await server.db.models['setting'].get('app.register.emailVerification')) === 'true';
            const userData = {
                firstName: data.firstName,
                lastName: data.lastName,
                userName: data.userName,
                password: data.password,
                email: data.email,
                acceptTerms: data.acceptTerms,
                acceptStats: data.acceptStats,
                acceptedAt: data.acceptedAt,
            };
            const newUser = await server.db.models['user'].add(userData, { transaction });

            // Generate email verification token if verification is enabled
            if (emailVerificationEnabled) {
                const tokenExpiry = await email.getEmailVerificationTokenExpiry();
                const verificationToken = generateToken(tokenExpiry);
                await server.db.models['user'].update(
                    { emailVerificationToken: verificationToken },
                    { where: { id: newUser.id }, transaction }
                );

                const baseUrl = await email.getBaseUrl();
                const verificationLink = `http://${baseUrl}/login?token=${verificationToken}`;
                const emailContent = await email.getEmailContent(
                    'email.template.registration',
                    'registration',
                    {
                        userId: newUser.id,
                        baseUrl,
                        link: verificationLink,
                        userName: data.userName,
                        tokenExpiry,
                        options: { transaction },
                    }
                );

                await server.sendMail(
                    data.email,
                    emailContent.subject,
                    emailContent.body,
                    { isHtml: emailContent.isHtml }
                );
                await transaction.commit();
                return res.status(201).json({
                    message: 'auth.api.userCreatedVerifyEmail',
                    emailVerificationRequired: true,
                });
            }

            await transaction.commit();
            return res.status(201).json({ message: 'auth.api.userCreated' });
        } catch (err) {
            if (transaction) {
                await transaction.rollback();
            }
            server.logger.error('Cannot create user:', err);
            return res.status(400).json({ message: 'auth.api.failedToCreateUser', error: err.message });
        }
    });
}

module.exports = {
    registerRegistrationRoutes,
};
