'use strict';

const passport = require('passport');
const { relevantFields } = require('../../../utils/auth');

/**
 * Register login/logout/session-check routes, including local and external provider entrypoints.
 *
 * @param {Server} server main server instance
 * @param {{shared: Object, twoFactor: Object}} helpers
 */
function registerLoginRoutes(server, helpers) {
    const { shared, twoFactor } = helpers;

    /**
     * Local username/password login route.
     */
    server.app.post('/auth/login', async (req, res, next) => {
        shared.setPostLoginRedirectPath(req, req.body?.redirectedFrom);

        passport.authenticate('local-login', async (err, user, info) => {
            if (err) {
                server.logger.error('Login failed: ' + err);
                return res.status(500).json({ message: 'auth.api.failedToLogin' });
            }
            if (!user) {
                server.logger.info('User not found: ' + JSON.stringify(info));
                return res.status(401).send(info);
            }

            const emailVerificationEnabled = String(await server.db.models['setting'].get('app.register.emailVerification')) === 'true';
            if (emailVerificationEnabled && !user.emailVerified) {
                return res.status(401).json({
                    message: 'auth.api.emailNotVerifiedBeforeLogin',
                    emailNotVerified: true,
                    email: user.email,
                });
            }

            const twoFactorHandled = await twoFactor.startTwoFactorLogin(req, res, user.id, { mode: 'json', loginMethod: 'local' });
            if (twoFactorHandled) return;

            shared.addLoginMethod(user, 'local');
            return shared.finalizeLogin(req, res, user, { mode: 'json' });
        })(req, res, next);
    });

    /**
     * LDAP login route.
     */
    server.app.post('/auth/login/ldap', async (req, res, next) => {
        shared.setPostLoginRedirectPath(req, req.body?.redirectedFrom || req.query?.redirectedFrom);

        if (!(await shared.isLoginMethodEnabled('ldap'))) {
            return res.status(403).json({ message: 'auth.api.ldapLoginDisabled' });
        }
        if (!server.isAuthProviderReady('ldap')) {
            const status = server.getAuthProviderStatus('ldap');
            return res.status(503).json({
                message: 'auth.api.ldapLoginNotReady',
                reason: status.reason,
            });
        }

        passport.authenticate('ldap-login', async (err, user, info) => {
            if (err) {
                server.logger.error('LDAP login failed: ' + err);
                return res.status(500).json({ message: 'auth.api.failedToLogin' });
            }
            if (!user) {
                return res.status(401).json(info || { message: 'auth.api.ldapLoginFailed' });
            }

            const handled = await twoFactor.startTwoFactorLogin(req, res, user.id, { mode: 'json', loginMethod: 'ldap' });
            if (handled) return;

            shared.addLoginMethod(user, 'ldap');
            return shared.finalizeLogin(req, res, user, { mode: 'json' });
        })(req, res, next);
    });

    /**
     * ORCID login entrypoint.
     */
    server.app.get('/auth/login/orcid', async (req, res, next) => {
        const frontendBaseUrl = await shared.getFrontendBaseUrl();
        const redirectedFrom = shared.setPostLoginRedirectPath(req, req.query?.redirectedFrom);
        if (!(await shared.isLoginMethodEnabled('orcid'))) {
            return res.redirect(shared.buildFrontendUrl(frontendBaseUrl, '/login', {
                error: 'orcid-login-disabled',
                redirectedFrom,
            }));
        }
        if (!server.isAuthProviderReady('orcid')) {
            const status = server.getAuthProviderStatus('orcid');
            server.logger.warn(`[Auth] ORCID requested but provider is not ready (${status.reason}).`);
            return res.redirect(shared.buildFrontendUrl(frontendBaseUrl, '/login', {
                error: 'orcid-login-not-ready',
                redirectedFrom,
            }));
        }
        return passport.authenticate('orcid-login')(req, res, next);
    });

    /**
     * ORCID callback route. Continues either to 2FA or directly to finalized login.
     */
    server.app.get('/auth/2fa/orcid/callback',
        async (req, res, next) => {
            const frontendBaseUrl = await shared.getFrontendBaseUrl();
            const redirectedFrom = shared.getPostLoginRedirectPath(req, null);
            if (!(await shared.isLoginMethodEnabled('orcid'))) {
                return res.redirect(shared.buildFrontendUrl(frontendBaseUrl, '/login', {
                    error: 'orcid-login-disabled',
                    redirectedFrom,
                }));
            }
            if (!server.isAuthProviderReady('orcid')) {
                const status = server.getAuthProviderStatus('orcid');
                server.logger.warn(`[Auth] ORCID callback hit but provider is not ready (${status.reason}).`);
                return res.redirect(shared.buildFrontendUrl(frontendBaseUrl, '/login', {
                    error: 'orcid-login-not-ready',
                    redirectedFrom,
                }));
            }
            const failureRedirect = shared.buildFrontendUrl(frontendBaseUrl, '/login', {
                error: 'orcid-login-failed',
                redirectedFrom,
            });
            return passport.authenticate('orcid-login', { failureRedirect })(req, res, next);
        },
        async (req, res) => {
            const user = req.user;
            const handled = await twoFactor.startTwoFactorLogin(req, res, user.id, { mode: 'redirect', loginMethod: 'orcid' });
            if (handled) return;

            shared.addLoginMethod(user, 'orcid');
            return shared.finalizeLogin(req, res, user, { mode: 'redirect' });
        }
    );

    /**
     * SAML login entrypoint.
     */
    server.app.get('/auth/login/saml', async (req, res, next) => {
        const frontendBaseUrl = await shared.getFrontendBaseUrl();
        const redirectedFrom = shared.setPostLoginRedirectPath(req, req.query?.redirectedFrom);
        if (!(await shared.isLoginMethodEnabled('saml'))) {
            return res.redirect(shared.buildFrontendUrl(frontendBaseUrl, '/login', {
                error: 'saml-login-disabled',
                redirectedFrom,
            }));
        }
        if (!server.isAuthProviderReady('saml')) {
            const status = server.getAuthProviderStatus('saml');
            server.logger.warn(`[Auth] SAML requested but provider is not ready (${status.reason}).`);
            return res.redirect(shared.buildFrontendUrl(frontendBaseUrl, '/login', {
                error: 'saml-login-not-ready',
                redirectedFrom,
            }));
        }
        return passport.authenticate('saml-login')(req, res, next);
    });

    /**
     * SAML callback route. Continues either to 2FA or directly to finalized login.
     */
    server.app.post('/auth/login/saml/callback',
        async (req, res, next) => {
            const frontendBaseUrl = await shared.getFrontendBaseUrl();
            const redirectedFrom = shared.getPostLoginRedirectPath(req, null);
            if (!(await shared.isLoginMethodEnabled('saml'))) {
                return res.redirect(shared.buildFrontendUrl(frontendBaseUrl, '/login', {
                    error: 'saml-login-disabled',
                    redirectedFrom,
                }));
            }
            if (!server.isAuthProviderReady('saml')) {
                const status = server.getAuthProviderStatus('saml');
                server.logger.warn(`[Auth] SAML callback hit but provider is not ready (${status.reason}).`);
                return res.redirect(shared.buildFrontendUrl(frontendBaseUrl, '/login', {
                    error: 'saml-login-not-ready',
                    redirectedFrom,
                }));
            }
            const failureRedirect = shared.buildFrontendUrl(frontendBaseUrl, '/login', {
                error: 'saml-login-failed',
                redirectedFrom,
            });
            return passport.authenticate('saml-login', (err, user, info) => {
                if (err) {
                    server.logger.error(`[Auth] SAML authentication error: ${err.message}`);
                    return res.redirect(failureRedirect);
                }
                if (!user) {
                    const infoMessage = info?.message || 'Unknown SAML authentication failure.';
                    server.logger.warn(`[Auth] SAML authentication failed: ${infoMessage}`);
                    return res.redirect(failureRedirect);
                }

                return req.logIn(user, (loginErr) => {
                    if (loginErr) {
                        server.logger.error(`[Auth] SAML session login error: ${loginErr.message}`);
                        return res.redirect(failureRedirect);
                    }
                    return next();
                });
            })(req, res, next);
        },
        async (req, res) => {
            const user = req.user;
            const handled = await twoFactor.startTwoFactorLogin(req, res, user.id, { mode: 'redirect', loginMethod: 'saml' });
            if (handled) return;

            shared.addLoginMethod(user, 'saml');
            return shared.finalizeLogin(req, res, user, { mode: 'redirect' });
        }
    );

    /**
     * Logout route.
     */
    server.app.get('/auth/logout', (req, res, next) => {
        req.logout((err) => {
            if (err) {
                return next(err);
            }
            req.session.destroy();
            res.clearCookie('connect.sid');
            return res.status(200).json({ message: 'auth.api.sessionDestroyed' });
        });
    });

    /**
     * Return the current authenticated user (if any), needsSetup and wizardCompleted.
     */
    server.app.get('/auth/check', async (req, res) => {
        try {
            const admins = await server.db.models['user'].getUsersByRole('admin');
            const needsSetup = admins.length === 0;
            const wizardCompleted = (await server.db.models['setting'].get('app.setup.wizardCompleted')) === 'true';

            server.logger.debug(`req.session.passport: ${JSON.stringify(req.session && req.session.passport)}`);
            server.logger.debug(`req.user: ${JSON.stringify(req.user)}`);

            if (req.user) {
                return res.status(200).json({
                    user: relevantFields(req.user),
                    needsSetup,
                    wizardCompleted,
                });
            }
            return res.status(200).json({
                user: null,
                needsSetup,
                wizardCompleted,
            });
        } catch (err) {
            server.logger.error('auth/check error: ' + err);
            return res.status(500).json({ message: 'auth.api.internalServerError' });
        }
    });
}

module.exports = {
    registerLoginRoutes,
};
