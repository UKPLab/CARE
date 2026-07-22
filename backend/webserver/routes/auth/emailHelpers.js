'use strict';

const { getEmailContent } = require('../../../utils/helper/email');

/**
 * Build email-related helper functions shared by multiple auth route modules.
 *
 * @param {Server} server main server instance
 * @returns {Object} email helper functions
 */
function createEmailHelpers(server) {
    /**
     * Resolve the backend base URL used in links embedded into auth emails.
     *
     * @returns {Promise<string>}
     */
    async function getBaseUrl() {
        const baseUrl = await server.db.models['setting'].get('system.baseUrl');
        return baseUrl || 'localhost:3000';
    }

    /**
     * Get password reset token expiry in hours from settings.
     *
     * @returns {Promise<number|string>}
     */
    async function getPasswordResetTokenExpiry() {
        return await server.db.models['setting'].get('system.auth.tokenExpiry.passwordReset') || 1;
    }

    /**
     * Get email verification token expiry in hours from settings.
     *
     * @returns {Promise<number|string>}
     */
    async function getEmailVerificationTokenExpiry() {
        return await server.db.models['setting'].get('system.auth.tokenExpiry.emailVerification') || 24;
    }

    /**
     * Get the resend rate limit for password reset emails in minutes.
     *
     * @returns {Promise<number|string>}
     */
    async function getPasswordResetRateLimit() {
        return await server.db.models['setting'].get('app.login.passwordResetRateLimit') || 5;
    }

    /**
     * Get the resend rate limit for verification emails in minutes.
     *
     * @returns {Promise<number|string>}
     */
    async function getEmailVerificationRateLimit() {
        return await server.db.models['setting'].get('app.register.emailVerificationRateLimit') || 2;
    }

    /**
     * Check whether another auth-related email may already be sent for the user.
     *
     * @param {Object} user
     * @param {'passwordReset'|'verification'} emailType
     * @param {number} rateLimitMinutes
     * @returns {{allowed: boolean, remainingTime?: number}}
     */
    function checkEmailRateLimit(user, emailType, rateLimitMinutes) {
        const now = new Date();
        const lastSentField = emailType === 'passwordReset' ? 'lastPasswordResetEmailSent' : 'lastVerificationEmailSent';

        if (user[lastSentField]) {
            const timeDiff = (now - new Date(user[lastSentField])) / (1000 * 60);
            if (timeDiff < rateLimitMinutes) {
                return {
                    allowed: false,
                    remainingTime: Math.ceil(rateLimitMinutes - timeDiff),
                };
            }
        }

        return { allowed: true };
    }

    /**
     * Resolve email subject/body from configured template or fallback file.
     *
     * @param {string} settingKey
     * @param {string} fallbackKey
     * @param {Object} context
     * @returns {Promise<{subject: string, body: string, isHtml: boolean}>}
     */
    async function resolveEmailContent(settingKey, fallbackKey, context) {
        return await getEmailContent(settingKey, fallbackKey, context, server.db.models, server.logger);
    }

    return {
        checkEmailRateLimit,
        getBaseUrl,
        getEmailVerificationRateLimit,
        getEmailVerificationTokenExpiry,
        getPasswordResetRateLimit,
        getPasswordResetTokenExpiry,
        getEmailContent: resolveEmailContent,
    };
}

module.exports = {
    createEmailHelpers,
};
