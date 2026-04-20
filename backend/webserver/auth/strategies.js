'use strict';

const crypto = require('crypto');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const OrcidStrategy = require('passport-orcid').Strategy;
const LdapStrategy = require('passport-ldapauth');
const { Strategy: SamlStrategy } = require('@node-saml/passport-saml');
const { relevantFields } = require('../../utils/auth');
const {
    findOrProvisionExternalUser,
    getFirstPresentValue,
    getProvisionedNameParts,
} = require('./utils');

const SAML_ATTRIBUTE_KEYS = {
    email: [
        'email',
        'mail',
        'urn:oid:1.2.840.113549.1.9.1',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    ],
    firstName: [
        'firstName',
        'givenName',
        'urn:oid:2.5.4.42',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
    ],
    lastName: [
        'lastName',
        'sn',
        'surname',
        'familyName',
        'urn:oid:2.5.4.4',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
    ],
};

async function setupLocalStrategy(server) {
    passport.use('local-login', new LocalStrategy(async (username, password, cb) => {
        try {
            const user = await server.db.models['user'].find(username);
            if (!user) return cb(null, false, { message: 'Incorrect username or password.' });

            crypto.pbkdf2(password, user.salt, 310000, 32, 'sha256', (err, hashedPassword) => {
                if (err) return cb(err);
                if (!crypto.timingSafeEqual(Buffer.from(user.passwordHash, 'hex'), hashedPassword)) {
                    return cb(null, false, { message: 'Incorrect username or password.' });
                }
                // filter row object, because not everything is the right information for website
                return cb(null, relevantFields(user));
            });
        } catch (error) {
            return cb(error);
        }
    }));

    server.authProviderStatus.local = { ready: true, reason: 'ready' };
}

async function setupOrcidStrategy(server) {
    const enabled = (await server.db.models['setting'].get('system.auth.orcid.enabled')) === 'true';
    if (!enabled) {
        server.authProviderStatus.orcid = { ready: false, reason: 'disabled' };
        return;
    }

    const clientID = await server.db.models['setting'].get('system.auth.orcid.clientId');
    const clientSecret = await server.db.models['setting'].get('system.auth.orcid.clientSecret');
    const callbackURL = await server.db.models['setting'].get('system.auth.orcid.callbackUrl');
    const sandbox = (await server.db.models['setting'].get('system.auth.orcid.sandbox')) === 'true';

    const missing = [];
    if (!clientID) missing.push('system.auth.orcid.clientId');
    if (!clientSecret) missing.push('system.auth.orcid.clientSecret');
    if (!callbackURL) missing.push('system.auth.orcid.callbackUrl');
    if (missing.length > 0) {
        const reason = `missing-config:${missing.join(',')}`;
        server.authProviderStatus.orcid = { ready: false, reason };
        server.logger.warn(`[Auth] ORCID login enabled but not ready (${reason}).`);
        return;
    }

    const config = {
        sandbox,
        clientID,
        clientSecret,
        callbackURL,
        passReqToCallback: true,
    };

    try {
        passport.use('orcid-login', new OrcidStrategy(config, async (req, accessToken, refreshToken, params, profile, done) => {
            try {
                const orcidId = params.orcid;
                if (!orcidId) return done(new Error('ORCID response missing ORCID identifier'));

                const email = getFirstPresentValue(profile, ['email', 'mail']) || params.email || null;
                const nameParts = getProvisionedNameParts({
                    firstName: getFirstPresentValue(profile, ['firstName', 'givenName']),
                    lastName: getFirstPresentValue(profile, ['lastName', 'familyName', 'surname']),
                    email,
                    fullName: params.name,
                    fallbackFirstName: 'ORCID',
                    fallbackLastName: 'User',
                });

                const user = await findOrProvisionExternalUser(server, {
                    externalField: 'orcidId',
                    externalValue: orcidId,
                    email,
                    createData: {
                        firstName: nameParts.firstName,
                        lastName: nameParts.lastName,
                        emailVerified: !!email,
                    },
                });
                return done(null, relevantFields(user));
            } catch (error) {
                return done(error);
            }
        }));
        server.authProviderStatus.orcid = { ready: true, reason: 'ready' };
    } catch (error) {
        server.authProviderStatus.orcid = { ready: false, reason: `init-error:${error.message}` };
        server.logger.error(`[Auth] Failed to initialize ORCID strategy: ${error.message}`);
    }
}

async function setupLdapStrategy(server) {
    const enabled = (await server.db.models['setting'].get('system.auth.ldap.enabled')) === 'true';
    if (!enabled) {
        server.authProviderStatus.ldap = { ready: false, reason: 'disabled' };
        return;
    }

    const url = await server.db.models['setting'].get('system.auth.ldap.url');
    const bindDN = await server.db.models['setting'].get('system.auth.ldap.bindDN');
    const bindCredentials = await server.db.models['setting'].get('system.auth.ldap.bindCredentials') || process.env.LDAP_BIND_CREDENTIALS;
    const searchBase = await server.db.models['setting'].get('system.auth.ldap.searchBase') || process.env.LDAP_SEARCH_BASE;
    const searchFilter = (await server.db.models['setting'].get('system.auth.ldap.searchFilter')) || process.env.LDAP_SEARCH_FILTER || '(uid={{username}})';

    const missing = [];
    if (!url) missing.push('system.auth.ldap.url');
    if (!bindDN) missing.push('system.auth.ldap.bindDN');
    if (!bindCredentials) missing.push('system.auth.ldap.bindCredentials');
    if (!searchBase) missing.push('system.auth.ldap.searchBase');
    if (missing.length > 0) {
        const reason = `missing-config:${missing.join(',')}`;
        server.authProviderStatus.ldap = { ready: false, reason };
        server.logger.warn(`[Auth] LDAP login enabled but not ready (${reason}).`);
        return;
    }

    const serverConfig = {
        url,
        bindDN,
        bindCredentials,
        searchBase,
        searchFilter,
    };

    try {
        passport.use('ldap-login', new LdapStrategy({ server: serverConfig, passReqToCallback: true }, async (req, ldapUser, done) => {
            try {
                const username = Array.isArray(ldapUser?.uid) ? ldapUser.uid[0] : ldapUser?.uid;
                const email = [].concat(ldapUser?.mail || ldapUser?.email || [])[0];
                const nameParts = getProvisionedNameParts({
                    firstName: [].concat(ldapUser?.givenName || ldapUser?.cn || [])[0],
                    lastName: [].concat(ldapUser?.sn || [])[0],
                    email,
                    fullName: [].concat(ldapUser?.cn || [])[0],
                    fallbackFirstName: 'LDAP',
                    fallbackLastName: 'User',
                });

                if (!username) return done(new Error('LDAP user missing UID'));

                const user = await findOrProvisionExternalUser(server, {
                    externalField: 'ldapUsername',
                    externalValue: username,
                    email,
                    createData: {
                        firstName: nameParts.firstName,
                        lastName: nameParts.lastName,
                        email,
                        emailVerified: !!email,
                    },
                });
                return done(null, relevantFields(user));
            } catch (error) {
                return done(error);
            }
        }));
        server.authProviderStatus.ldap = { ready: true, reason: 'ready' };
    } catch (error) {
        server.authProviderStatus.ldap = { ready: false, reason: `init-error:${error.message}` };
        server.logger.error(`[Auth] Failed to initialize LDAP strategy: ${error.message}`);
    }
}

async function setupSamlStrategy(server) {
    const enabled = (await server.db.models['setting'].get('system.auth.saml.enabled')) === 'true';
    if (!enabled) {
        server.authProviderStatus.saml = { ready: false, reason: 'disabled' };
        return;
    }

    const entryPoint = await server.db.models['setting'].get('system.auth.saml.entryPoint');
    const issuer = await server.db.models['setting'].get('system.auth.saml.issuer');
    const callbackURL = await server.db.models['setting'].get('system.auth.saml.callbackUrl');
    const rawCert = await server.db.models['setting'].get('system.auth.saml.cert');
    const cert = typeof rawCert === 'string' ? rawCert.replace(/\\n/g, '\n') : rawCert;

    const missing = [];
    if (!entryPoint) missing.push('system.auth.saml.entryPoint');
    if (!issuer) missing.push('system.auth.saml.issuer');
    if (!callbackURL) missing.push('system.auth.saml.callbackUrl');
    if (!cert) missing.push('system.auth.saml.cert');
    if (missing.length > 0) {
        const reason = `missing-config:${missing.join(',')}`;
        server.authProviderStatus.saml = { ready: false, reason };
        server.logger.warn(`[Auth] SAML login enabled but not ready (${reason}).`);
        return;
    }

    const config = {
        entryPoint,
        issuer,
        callbackUrl: callbackURL,
        idpCert: cert,
        wantAssertionsSigned: false,
        wantAuthnResponseSigned: false,
    };

    try {
        passport.use('saml-login', new SamlStrategy(config, async (profile, done) => {
            try {
                const nameId = profile?.nameID;
                const email = getFirstPresentValue(profile, SAML_ATTRIBUTE_KEYS.email) || nameId;
                const nameParts = getProvisionedNameParts({
                    firstName: getFirstPresentValue(profile, SAML_ATTRIBUTE_KEYS.firstName),
                    lastName: getFirstPresentValue(profile, SAML_ATTRIBUTE_KEYS.lastName),
                    email,
                    fullName: null,
                    fallbackFirstName: 'SSO',
                    fallbackLastName: 'User',
                });

                if (!nameId) {
                    return done(null, false, { message: 'Missing SAML NameID.' });
                }
                if (!email) {
                    return done(null, false, { message: 'Missing SAML email.' });
                }

                const user = await findOrProvisionExternalUser(server, {
                    externalField: 'samlNameId',
                    externalValue: nameId,
                    email,
                    createData: {
                        firstName: nameParts.firstName,
                        lastName: nameParts.lastName,
                        email,
                        emailVerified: true,
                        acceptTerms: false,
                    },
                });
                return done(null, relevantFields(user));
            } catch (error) {
                return done(error);
            }
        }));
        server.authProviderStatus.saml = { ready: true, reason: 'ready' };
    } catch (error) {
        server.authProviderStatus.saml = { ready: false, reason: `init-error:${error.message}` };
        server.logger.error(`[Auth] Failed to initialize SAML strategy: ${error.message}`);
    }
}

async function registerStrategies(server) {
    await setupLocalStrategy(server);
    await setupOrcidStrategy(server);
    await setupLdapStrategy(server);
    await setupSamlStrategy(server);
}

module.exports = {
    registerStrategies,
};
