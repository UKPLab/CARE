"use strict";

const settings = [
    {
        key: "system.auth.orcid.enabled",
        type: "boolean",
        value: false,
        description: "Enable ORCID login flow"
    },
    {
        key: "system.auth.ldap.enabled",
        type: "boolean",
        value: false,
        description: "Enable LDAP login flow"
    },
    {
        key: "system.auth.saml.enabled",
        type: "boolean",
        value: false,
        description: "Enable SAML login flow"
    },
    {
        key: "system.auth.local.2fa.required",
        type: "boolean",
        value: false,
        description: "Require 2FA setup for local login users"
    },
    {
        key: "system.auth.orcid.2fa.required",
        type: "boolean",
        value: false,
        description: "Require 2FA setup for ORCID login users"
    },
    {
        key: "system.auth.ldap.2fa.required",
        type: "boolean",
        value: false,
        description: "Require 2FA setup for LDAP login users"
    },
    {
        key: "system.auth.saml.2fa.required",
        type: "boolean",
        value: false,
        description: "Require 2FA setup for SAML login users"
    },
    {
        key: "system.auth.redirect.baseUrl",
        type: "string",
        value: "http://localhost:3000",
        description: "Frontend base URL for authentication redirects (login success, OAuth callback, and 2FA verification pages)"
    },
    {
        key: "system.auth.orcid.clientId",
        type: "string",
        value: "",
        description: "ORCID OAuth client id (changes require a restart of the server)",
        onlyAdmin: true
    },
    {
        key: "system.auth.orcid.clientSecret",
        type: "string",
        value: "",
        description: "ORCID OAuth client secret (changes require a restart of the server)",
        onlyAdmin: true
    },
    {
        key: "system.auth.orcid.callbackUrl",
        type: "string",
        value: "",
        description: "ORCID callback URL (changes require a restart of the server)"
    },
    {
        key: "system.auth.orcid.sandbox",
        type: "boolean",
        value: true,
        description: "Use ORCID sandbox mode (changes require a restart of the server)"
    },
    {
        key: "system.auth.ldap.url",
        type: "string",
        value: "",
        description: "LDAP server URL (changes require a restart of the server)"
    },
    {
        key: "system.auth.ldap.bindDN",
        type: "string",
        value: "",
        description: "LDAP bind DN (changes require a restart of the server)",
        onlyAdmin: true
    },
    {
        key: "system.auth.ldap.bindCredentials",
        type: "string",
        value: "",
        description: "LDAP bind password (changes require a restart of the server)",
        onlyAdmin: true
    },
    {
        key: "system.auth.ldap.searchBase",
        type: "string",
        value: "",
        description: "LDAP user search base (changes require a restart of the server)"
    },
    {
        key: "system.auth.ldap.searchFilter",
        type: "string",
        value: "(uid={{username}})",
        description: "LDAP search filter template (changes require a restart of the server)"
    },
    {
        key: "system.auth.saml.entryPoint",
        type: "string",
        value: "",
        description: "SAML identity provider entry point (changes require a restart of the server)"
    },
    {
        key: "system.auth.saml.issuer",
        type: "string",
        value: "",
        description: "SAML service provider issuer (changes require a restart of the server)"
    },
    {
        key: "system.auth.saml.cert",
        type: "text",
        value: "",
        description: "SAML identity provider certificate (changes require a restart of the server)",
        onlyAdmin: true
    },
    {
        key: "system.auth.saml.callbackUrl",
        type: "string",
        value: "",
        description: "SAML callback URL (changes require a restart of the server)"
    },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.bulkInsert("setting",
            settings.map((setting) => ({
                ...setting,
                createdAt: new Date(),
                updatedAt: new Date(),
            })),
        );
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete("setting", {
            key: settings.map((setting) => setting.key)
        }, {});
    }
};
