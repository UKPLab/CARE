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
 * @param {object} models
 * @returns {Promise<{user: object, password: string}>}
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