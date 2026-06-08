'use strict';

const crypto = require('crypto');
const { io: SocketIOClient } = require('socket.io-client');


/**
 * Sign a session ID using the express-session HMAC-SHA256 scheme.
 * @param {string} sid - Raw session identifier
 * @param {string} secret - Session secret from server config
 * @returns {string} Signed session ID in format s:<sid>.<signature>
 */
function signSessionId(sid, secret) {
    const signature = crypto
        .createHmac('sha256', secret)
        .update(sid)
        .digest('base64')
        .replace(/=+$/, '');
    return `s:${sid}.${signature}`;
}

/**
 * Create an authenticated socket.io-client by writing a Passport
 * session directly to the session store.
 * @param {Object} server - CARE server instance
 * @param {Object} user - User row from DB
 * @param {string} serverUrl - Target server URL
 * @returns {Promise<import("socket.io-client").Socket>} Connected client
 * @throws {Error} If the client fails to connect
 */
async function createAuthenticatedClient(server, user, serverUrl) {
    const sid = crypto.randomBytes(18).toString('hex');

    const sessionData = JSON.stringify({
        cookie: {
            originalMaxAge: null,
            expires: null,
            httpOnly: true,
            path: '/',
        },
        passport: {
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                userName: user.userName,
                email: user.email,
                rolesUpdatedAt: user.rolesUpdatedAt || null,
            },
        },
    });

    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await server.db.sequelize.query(
        `INSERT INTO "Sessions" ("sid", "expires", "data", "createdAt", "updatedAt")
         VALUES (:sid, :expires, :data, :now, :now)`,
        {
            replacements: {
                sid,
                expires: expires.toISOString(),
                data: sessionData,
                now: new Date().toISOString(),
            },
            type: server.db.sequelize.QueryTypes.INSERT,
        }
    );
    // NOTE: This must match the express-session secret in Server.js (#initSessionManagement).
    // Replay clients mint their own session cookies using this HMAC secret so that the
    // session middleware accepts them as valid logged-in sessions. When the session secret
    // is moved to an env var (see GitHub issue on hardcoded session secret), this literal
    // must be updated to read from the same env var — otherwise replay auth will break.
    const secret = 'secretString';
    const signedSid = signSessionId(sid, secret);
    const cookie = `connect.sid=${encodeURIComponent(signedSid)}`;

    const client = SocketIOClient(serverUrl, {
        extraHeaders: { cookie },
        reconnection: false,
        timeout: 10000,
    });

    return new Promise((resolve, reject) => {
        // Wait for the server's "ready" signal rather than a fixed delay. The
        // server emits this once all per-socket handlers are initialized and
        // listening, so the first replayed trace can't race handler setup.
        client.on('ready', () => resolve(client));
        client.on('connect_error', (err) => {
            reject(new Error(`Replay auth failed for user ${user.id}: ${err.message}`));
        });
    });
}

/**
 * Disconnect a replay client and remove its session from the store.
 * @param {Object} server - CARE server instance
 * @param {import("socket.io-client").Socket} client - The replay client to clean up
 */
async function cleanupSession(server, client) {
    try {
        const cookie = client.io.opts.extraHeaders?.cookie || '';
        const match = cookie.match(/connect\.sid=s%3A([^.]+)\./);
        if (match) {
            await server.db.sequelize.query(
                `DELETE FROM "Sessions" WHERE "sid" = :sid`,
                { replacements: { sid: match[1] } }
            );
        }
        client.disconnect();
    } catch (err) {
        // best-effort cleanup
    }
}

module.exports = {
    createAuthenticatedClient,
    cleanupSession,
};