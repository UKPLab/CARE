'use strict';

const crypto = require('crypto');
const { io: SocketIOClient } = require('socket.io-client');


/**
 * Sign a session ID using the express-session HMAC-SHA256 scheme.
 * @param {string} sid - Raw session identifier
 * @param {string} secret - The express-session secret (SESSION_SECRET)
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

// Replay clients are given the same connect timeout for the handshake and for
// the server's ready signal.
const CONNECT_TIMEOUT_MS = 10000;

/**
 * Delete one session row from the store.
 * @param {Object} server - CARE server instance
 * @param {string} sid - Raw session identifier
 * @returns {Promise<void>}
 */
async function deleteSession(server, sid) {
    await server.db.sequelize.query(
        `DELETE FROM "Sessions" WHERE "sid" = :sid`,
        { replacements: { sid } }
    );
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
    // Replay clients mint their own session cookies, so this must be the same
    // secret express-session verifies with in Server.js (#initSessionManagement)
    // — otherwise the middleware rejects them and replay can't authenticate.
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
        throw new Error('SESSION_SECRET is not set — replay cannot mint session cookies');
    }
    const signedSid = signSessionId(sid, secret);
    const cookie = `connect.sid=${encodeURIComponent(signedSid)}`;

    const client = SocketIOClient(serverUrl, {
        extraHeaders: { cookie },
        reconnection: false,
        timeout: CONNECT_TIMEOUT_MS,
    });

    try {
        return await new Promise((resolve, reject) => {
            // Wait for the server's "ready" signal rather than a fixed delay. The
            // server emits this once all per-socket handlers are initialized and
            // listening, so the first replayed trace can't race handler setup.
            const timer = setTimeout(() => {
                reject(new Error(`Replay client for user ${user.id} connected but got no ready signal within ${CONNECT_TIMEOUT_MS}ms`));
            }, CONNECT_TIMEOUT_MS);
            client.on('ready', () => {
                clearTimeout(timer);
                resolve(client);
            });
            client.on('connect_error', (err) => {
                clearTimeout(timer);
                reject(new Error(`Replay auth failed for user ${user.id}: ${err.message}`));
            });
        });
    } catch (err) {
        // The session row is written before connecting, so a failed connect
        // would leave it behind for its full lifetime. Clean up our own mess.
        await deleteSession(server, sid).catch(() => { /* best effort */ });
        client.close();
        throw err;
    }
}

/**
 * Disconnect a replay client and remove its session from the store.
 * @param {Object} server - CARE server instance
 * @param {import("socket.io-client").Socket} client - The replay client to clean up
 * @returns {Promise<void>}
 */
async function cleanupSession(server, client) {
    if (!client) {
        return;
    }
    try {
        const cookie = client.io.opts.extraHeaders?.cookie || '';
        const match = cookie.match(/connect\.sid=s%3A([^.]+)\./);
        if (match) {
            await deleteSession(server, match[1]);
        }
        client.disconnect();
    } catch (err) {
        // Best-effort: a failure here won't corrupt replay results, but a failed
        // DELETE leaves an orphaned row in "Sessions", so surface it.
        server.logger.warn("Replay session cleanup failed: " + err.message);
    }
}

module.exports = {
    createAuthenticatedClient,
    cleanupSession,
};