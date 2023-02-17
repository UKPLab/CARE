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