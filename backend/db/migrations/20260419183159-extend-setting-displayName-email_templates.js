'use strict';

/**
 * Set displayName, displayGroup, and displaySubsection for settings whose rows are
 * created or extended after extend-setting-displayName (email templates including
 * twoFactorOtp / passwordResetSuccess, logo, external auth / 2FA).
 *
 * @type {import('sequelize-cli').Migration}
 */

const UPDATES = [
    { key: 'email.template.passwordReset', displayName: 'Password reset email', displayGroup: 'Mail', displaySubsection: 'Email templates' },
    { key: 'email.template.verification', displayName: 'Email verification', displayGroup: 'Mail', displaySubsection: 'Email templates' },
    { key: 'email.template.registration', displayName: 'Registration welcome email', displayGroup: 'Mail', displaySubsection: 'Email templates' },
    { key: 'email.template.sessionStart', displayName: 'Study session start email', displayGroup: 'Mail', displaySubsection: 'Email templates' },
    { key: 'email.template.sessionFinish', displayName: 'Study session finish email', displayGroup: 'Mail', displaySubsection: 'Email templates' },
    { key: 'email.template.assignment', displayName: 'Assignment notification email', displayGroup: 'Mail', displaySubsection: 'Email templates' },
    { key: 'email.template.studyClosed', displayName: 'Study closed email', displayGroup: 'Mail', displaySubsection: 'Email templates' },
    { key: 'email.template.twoFactorOtp', displayName: 'Two-factor OTP email', displayGroup: 'Mail', displaySubsection: 'Email templates' },
    { key: 'email.template.passwordResetSuccess', displayName: 'Password reset success email', displayGroup: 'Mail', displaySubsection: 'Email templates' },

    { key: 'logo.reBgColor', displayName: 'Logo RE section background colour', displayGroup: 'Interface', displaySubsection: 'Branding' },

    { key: 'system.auth.orcid.enabled', displayName: 'Enable ORCID login', displayGroup: 'General', displaySubsection: 'ORCID login' },
    { key: 'system.auth.orcid.clientId', displayName: 'ORCID client ID', displayGroup: 'General', displaySubsection: 'ORCID login' },
    { key: 'system.auth.orcid.clientSecret', displayName: 'ORCID client secret', displayGroup: 'General', displaySubsection: 'ORCID login' },
    { key: 'system.auth.orcid.callbackUrl', displayName: 'ORCID callback URL', displayGroup: 'General', displaySubsection: 'ORCID login' },
    { key: 'system.auth.orcid.sandbox', displayName: 'ORCID sandbox mode', displayGroup: 'General', displaySubsection: 'ORCID login' },

    { key: 'system.auth.ldap.enabled', displayName: 'Enable LDAP login', displayGroup: 'General', displaySubsection: 'LDAP login' },
    { key: 'system.auth.ldap.url', displayName: 'LDAP server URL', displayGroup: 'General', displaySubsection: 'LDAP login' },
    { key: 'system.auth.ldap.bindDN', displayName: 'LDAP bind DN', displayGroup: 'General', displaySubsection: 'LDAP login' },
    { key: 'system.auth.ldap.bindCredentials', displayName: 'LDAP bind password', displayGroup: 'General', displaySubsection: 'LDAP login' },
    { key: 'system.auth.ldap.searchBase', displayName: 'LDAP search base', displayGroup: 'General', displaySubsection: 'LDAP login' },
    { key: 'system.auth.ldap.searchFilter', displayName: 'LDAP search filter', displayGroup: 'General', displaySubsection: 'LDAP login' },

    { key: 'system.auth.saml.enabled', displayName: 'Enable SAML login', displayGroup: 'General', displaySubsection: 'SAML login' },
    { key: 'system.auth.saml.entryPoint', displayName: 'SAML IdP entry point', displayGroup: 'General', displaySubsection: 'SAML login' },
    { key: 'system.auth.saml.issuer', displayName: 'SAML SP issuer', displayGroup: 'General', displaySubsection: 'SAML login' },
    { key: 'system.auth.saml.cert', displayName: 'SAML IdP certificate', displayGroup: 'General', displaySubsection: 'SAML login' },
    { key: 'system.auth.saml.callbackUrl', displayName: 'SAML callback URL', displayGroup: 'General', displaySubsection: 'SAML login' },

    { key: 'system.auth.local.2fa.required', displayName: 'Require 2FA for local login', displayGroup: 'General', displaySubsection: 'Two-factor authentication' },
    { key: 'system.auth.orcid.2fa.required', displayName: 'Require 2FA for ORCID login', displayGroup: 'General', displaySubsection: 'Two-factor authentication' },
    { key: 'system.auth.ldap.2fa.required', displayName: 'Require 2FA for LDAP login', displayGroup: 'General', displaySubsection: 'Two-factor authentication' },
    { key: 'system.auth.saml.2fa.required', displayName: 'Require 2FA for SAML login', displayGroup: 'General', displaySubsection: 'Two-factor authentication' },

    { key: 'system.auth.redirect.baseUrl', displayName: 'Frontend base URL for auth redirects', displayGroup: 'General', displaySubsection: 'Auth redirects' },
];

module.exports = {
    async up(queryInterface, Sequelize) {
        const now = new Date();
        for (const u of UPDATES) {
            await queryInterface.sequelize.query(
                `UPDATE setting SET "displayName" = :dn, "displayGroup" = :dg, "displaySubsection" = :ds, "updatedAt" = :now WHERE key = :k`,
                { replacements: { dn: u.displayName, dg: u.displayGroup, ds: u.displaySubsection, k: u.key, now } }
            );
        }
    },

    async down(queryInterface, Sequelize) {
        const now = new Date();
        const keys = UPDATES.map((u) => u.key);
        for (const k of keys) {
            await queryInterface.sequelize.query(
                `UPDATE setting SET "displayName" = NULL, "displayGroup" = NULL, "displaySubsection" = NULL, "updatedAt" = :now WHERE key = :k`,
                { replacements: { k, now } }
            );
        }
    },
};
