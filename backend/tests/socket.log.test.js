const Server = require("../webserver/Server.js");
const {getSocketClient} = require("./utils.js");

describe("Test Websockets - Log", () => {
    let clientSocket;

    beforeAll(async () => {
        this.server = new Server();
        this.server.start(3010);
    });

    beforeEach(async () => {
        clientSocket = await getSocketClient(this.server, process.env.ADMIN_EMAIL, process.env.ADMIN_PWD);
        this.server.db.sequelize.sync();
    });


    test("Load Logs", (done) => {
        clientSocket.on("logAll", (data) => {
            expect(Array.isArray(data)).toBe(true);
            done();
        })
        clientSocket.emit("logGetAll", {limit: 100})
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