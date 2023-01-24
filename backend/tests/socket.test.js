const request = require('supertest')
const Init = require("../index.js");
const {io: Client} = require("socket.io-client");
const Server = require("../webserver/Server.js");

const COOKIE_NAME = "connect.sid";

describe("Test Websockets", () => {
    let clientSocket;
    beforeAll(() => {
        this.server = new Server();
        this.server.start(3010);
    });

    beforeEach(async () => {
        const res = await request(this.server.app)
            .post('/auth/login')
            .send({
                username: process.env.ADMIN_EMAIL,
                password: process.env.ADMIN_PWD,
            })
        const cookie = res.header['set-cookie'][0];
        if (res.statusCode !== 200) {
            throw new Error("Could not login");
        }
        console.log("Cookie: ", cookie);

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
        }

        clientSocket = Client("http://localhost:3010", options);
    });

    it("Test Settings", (done) => {
        clientSocket.on("settingRefresh", (data) => {
            expect('tags.tagSet.default' in data).toBe(true);
            done();
        })
        clientSocket.emit("settingGetAll")
    });

    afterEach(() => {
        clientSocket.disconnect();
    });

    afterAll(() => {
        this.server.stop();
    });


});