'use strict';

/**
 * Build shared route-level helpers used across auth route modules.
 *
 * @param {Server} server main server instance
 * @returns {Object} shared helpers
 */
function createSharedHelpers(server) {
    /**
     * Normalize a frontend-internal post-login redirect target.
     *
     * @param {string} value
     * @returns {string|null}
     */
    function normalizeRedirectPath(value) {
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//')) {
            return null;
        }

        try {
            const parsed = new URL(trimmed, 'http://localhost');
            return `${parsed.pathname}${parsed.search}${parsed.hash}`;
        } catch (_error) {
            return null;
        }
    }

    /**
     * Normalize a base URL by ensuring protocol is present and trimming trailing slashes.
     *
     * @param {string} value
     * @param {string} fallback
     * @returns {string}
     */
    function normalizeBaseUrl(value, fallback) {
        const rawValue = (value || fallback || '').trim();
        const withProtocol = /^https?:\/\//i.test(rawValue) ? rawValue : `http://${rawValue}`;
        return withProtocol.replace(/\/+$/, '');
    }

    async function getFrontendBaseUrl() {
        const frontendBaseUrl = await server.db.models['setting'].get('system.auth.redirect.baseUrl');
        return normalizeBaseUrl(frontendBaseUrl, 'http://localhost:3000');
    }

    /**
     * Build a frontend URL from base URL, route path, and query object.
     *
     * @param {string} frontendBaseUrl
     * @param {string} routePath
     * @param {Object} query
     * @returns {string}
     */
    function buildFrontendUrl(frontendBaseUrl, routePath, query = {}) {
        const safePath = `/${(routePath || '').replace(/^\/+/, '')}`;
        const queryString = new URLSearchParams(
            Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '')
        ).toString();
        return queryString ? `${frontendBaseUrl}${safePath}?${queryString}` : `${frontendBaseUrl}${safePath}`;
    }

    /**
     * Persist the frontend path to return to after authentication.
     *
     * @param {Object} req
     * @param {string} redirectPath
     * @returns {string|null}
     */
    function setPostLoginRedirectPath(req, redirectPath) {
        const normalizedPath = normalizeRedirectPath(redirectPath);
        if (!req?.session) return normalizedPath;

        if (normalizedPath) {
            req.session.postLoginRedirectPath = normalizedPath;
        } else {
            delete req.session.postLoginRedirectPath;
        }

        return normalizedPath;
    }

    /**
     * Read the stored post-login redirect target.
     *
     * @param {Object} req
     * @param {string} fallback
     * @returns {string}
     */
    function getPostLoginRedirectPath(req, fallback = '/dashboard') {
        return normalizeRedirectPath(req?.session?.postLoginRedirectPath) || fallback;
    }

    /**
     * Check whether the given login method is enabled in settings.
     *
     * @param {string} method
     * @returns {Promise<boolean>}
     */
    async function isLoginMethodEnabled(method) {
        return (await server.db.models['setting'].get(`system.auth.${method}.enabled`)) === 'true';
    }

    /**
     * Attach the origin login method to the user object returned to the frontend.
     *
     * @param {Object} user
     * @param {string} loginMethod
     */
    function addLoginMethod(user, loginMethod) {
        if (!user || !loginMethod) return;
        user.loginMethod = loginMethod;
    }

    /**
     * Finalize the login flow by establishing the passport session, clearing any
     * transient 2FA state, recording the login, and returning either JSON or a redirect.
     *
     * @param {Object} req
     * @param {Object} res
     * @param {Object} user
     * @param {{mode?: 'json'|'redirect', redirectPath?: string}} options
     * @returns {Promise<void>}
     */
    async function finalizeLogin(req, res, user, options = { mode: 'json', redirectPath: '/dashboard' }) {
        const mode = options.mode || 'json';

        req.logIn(user, async (err) => {
            if (err) {
                server.logger.error(`[Auth] Passport login failed for user ${user.id}: ${err}`);
                return res.status(500).json({ message: 'errors.auth.failedToEstablishLoginSession' });
            }

            // Pending 2FA state is only needed during login and should not survive a successful login.
            if (req.session.twoFactorPending) {
                delete req.session.twoFactorPending;
            }

            try {
                await server.db.models['user'].registerUserLogin(user.id);
            } catch (dbError) {
                server.logger.error(`[Auth] Failed to record login activity for user ${user.id}: ${dbError}`);
            }

            const finalRedirectPath = normalizeRedirectPath(options.redirectPath) || getPostLoginRedirectPath(req, '/dashboard');

            delete req.session.postLoginRedirectPath;

            req.session.save(async (saveErr) => {
                if (saveErr) {
                    server.logger.error(`[Auth] Session save failed for user ${user.id}: ${saveErr}`);
                }

                if (mode === 'redirect') {
                    const frontendBaseUrl = await getFrontendBaseUrl();
                    const finalUrl = buildFrontendUrl(frontendBaseUrl, finalRedirectPath);
                    return res.redirect(finalUrl);
                }

                return res.status(200).json({ user });
            });
        });
    }

    /**
     * Middleware that ensures a route is only reachable for authenticated users.
     *
     * @param {Object} req
     * @param {Object} res
     * @param {Function} next
     * @returns {void}
     */
    function ensureAuthenticated(req, res, next) {
        if (req.isAuthenticated()) {
            return next();
        }
        return res.status(401).json({ message: 'errors.auth.authenticationRequired' });
    }

    return {
        addLoginMethod,
        buildFrontendUrl,
        ensureAuthenticated,
        finalizeLogin,
        getPostLoginRedirectPath,
        getFrontendBaseUrl,
        isLoginMethodEnabled,
        setPostLoginRedirectPath,
    };
}

module.exports = {
    createSharedHelpers,
};
