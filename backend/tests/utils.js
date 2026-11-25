const request = require("supertest");
const {io: Client} = require("socket.io-client");

/**
 * Get a socket client that is logged in
 * @param server server with http and io
 * @param {number} port
 * @param {string} username
 * @param {password} password
 * @return {Promise<Socket>}
 */
exports.getSocketClient = async function (server, port, username, password) {
    await server.devAdminReady;
    const res = await request(server.http)
        .post('/auth/login')
        .send({
            username: username,
            password: password,
        })
    const cookie = res.header['set-cookie'][0];
    //console.log("Cookie: " + cookie)
    if (res.statusCode !== 200) {
        throw new Error("Could not login");
    }

    const options = {
        transportOptions: {
            polling: {
                extraHeaders: {
                    'Cookie': cookie
                }
            }
        },
        reconnection: true,
        autoConnect: true,
        timeout: 1000,
    };
    return Client("http://localhost:" + port, options);

}

/**
 * Non-admin researcher. The user hook assigns the default `user` role.
 *
 * @param {Object} models the database models
 * @returns {Promise<Object>} {user, password}
 */
exports.addResearcherUser = async function (models) {
    // Known password. Refuse outside Jest so it cannot land in a real database.
    if (process.env.NODE_ENV !== 'test') {
        throw new Error('addResearcherUser only runs when NODE_ENV is test');
    }
    const stamp = Date.now().toString(36) + Math.floor(Math.random() * 1000);
    const password = 'RestUser1!';
    const user = await models.user.add({
        email: `rest.user.${stamp}@example.test`,
        userName: `ru${stamp}`,
        firstName: 'Rest',
        lastName: 'User',
        password,
        acceptTerms: true,
        acceptStats: true,
        emailVerified: true,
    });
    return {user, password};
}

/**
 * Turn the REST API on for a test suite and lift its rate limits, since a suite sends far more
 * requests per minute than a script would. The limits themselves are tested in rest.api_token.
 *
 * @param {Object} models the database models
 * @returns {Promise<void>}
 */
exports.enableRestForTests = async function (models) {
    await models['setting'].set('system.auth.apiTokens.enabled', 'true');
    await models['setting'].set('system.auth.apiTokens.rateLimitPerMinute', '100000');
    await models['setting'].set('system.auth.apiTokens.heavyRateLimitPerMinute', '100000');
    await models['setting'].set('system.auth.apiTokens.failedAuthPerMinute', '100000');
};

/**
 * Every right the logged-in user may put on a token, for tests that need a full token.
 * Creating a token requires a rights list; there is no implicit "everything".
 *
 * @param {Server} server main server instance
 * @param {string|string[]} cookie session cookie of that user
 * @returns {Promise<string[]>} the right names
 */
exports.allTokenRights = async function (server, cookie) {
    const res = await request(server.http).get('/auth/api-tokens/rights').set('Cookie', cookie);
    return res.body.rights.map((right) => right.name);
};

