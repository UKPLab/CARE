const Server = require("../webserver/Server.js");
const {getSocketClient} = require("./utils.js");

describe("Test Websockets - User", () => {
    let clientSocket;

    beforeAll(async () => {
        this.server = new Server();
        this.server.start(3111);
    });

    beforeEach(async () => {
        clientSocket = await getSocketClient(this.server,3111, process.env.ADMIN_EMAIL, process.env.ADMIN_PWD);
    });

    test("Get User Data", (done) => {
        clientSocket.on("userData", (data) => {
            expect(data.success).toBe(true);
            expect(data.users.length).toBeGreaterThan(0);
            done();
        })
        clientSocket.emit("userGetData")
    });

    afterEach(() => {
        if (clientSocket.connected) {
            clientSocket.disconnect();
        }
    });

    afterAll(async () => {
        this.server.stop();
    });

});