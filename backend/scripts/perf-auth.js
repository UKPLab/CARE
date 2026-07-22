'use strict';

/**
 * Authenticate as a configured admin via the real /auth/login route and
 * return the session cookie for socket connections. No session forging — this
 * is a normal login, so it doesn't depend on the session secret.
 *
 * @param {string} serverUrl - e.g. http://localhost:3001
 * @param {string} userName - admin username (default seeded admin is "admin")
 * @param {string} password - admin password (from config/env, never hardcoded)
 * @returns {Promise<string>} The "connect.sid=..." cookie string
 */
async function loginAsAdmin(serverUrl, userName, password) {
    let res;
    try {
        res = await fetch(serverUrl + '/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: userName, password }),
            redirect: 'manual',
        });
    } catch (err) {
        throw new Error('Could not reach ' + serverUrl + '/auth/login — is the server running? (' + err.message + ')');
    }

    if (res.status === 401) {
        const body = await res.text().catch(() => '');
        throw new Error('Login rejected (401). Check perf admin credentials. If the account has 2FA or an unverified email, use a plain admin account. Server said: ' + body);
    }
    if (!res.ok) {
        throw new Error('Login failed: HTTP ' + res.status);
    }

    const setCookie = res.headers.get('set-cookie');
    const match = setCookie && setCookie.match(/connect\.sid=[^;]+/);
    if (!match) {
        throw new Error('Login succeeded but no connect.sid cookie was returned.');
    }
    return match[0];
}

/**
 * Verify a session cookie is a log* Verify a session cookie belongs to an authenticated session via /auth/check.
 * Does not check admin rights — admin is enforced at the socket in verifyAdminAccess().ged-in admin via /auth/check.
 * @param {string} serverUrl
 * @param {string} cookie - the "connect.sid=..." cookie
 * @returns {Promise<Object>} the user object
 */
async function verifyAuthenticatedSession(serverUrl, cookie) {
    const res = await fetch(serverUrl + '/auth/check', {
        headers: { cookie },
    });
    if (res.status !== 200) {
        throw new Error('Session check failed — cookie not accepted as logged in.');
    }
    const data = await res.json();
    if (!data.user) {
        throw new Error('Session check failed — cookie not accepted as logged in.');
    }
    return data.user;
}

module.exports = { loginAsAdmin, verifyAuthenticatedSession };