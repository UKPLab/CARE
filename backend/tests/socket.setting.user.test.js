const Server = require("../webserver/Server.js");
const {getSocketClient} = require("./utils.js");

describe("Test Websockets - Settings as User", () => {
    let clientSocket;

    beforeAll(async () => {
        this.server = new Server();
        this.server.start(3108);
    });

    beforeEach(async () => {
        clientSocket = await getSocketClient(this.server,3108, process.env.GUEST_EMAIL, process.env.GUEST_PWD);
    });

    test("Admin Settings not accessible by user", (done) => {
        clientSocket.on("settingRefresh", (data) => {
            expect(data["app.study.enabled"]).toBe("true");
            expect(data["service.nlp.token"]).toBe(undefined);
            done();
        })
        clientSocket.emit("settingGetAll")
    });

    test("Set Setting by user", (done) => {
        clientSocket.on("settingRefresh", (data) => {
            expect(data["test"]).toBe("true");
            done();
        })
        clientSocket.emit("settingSet", {key: "test", value: "true"})
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