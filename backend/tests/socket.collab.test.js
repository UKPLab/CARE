const Server = require("../webserver/Server.js");
const {getSocketClient} = require("./utils.js");

describe("Test Websockets - Collaboration", () => {
    let clientSocket;

    beforeAll(async () => {
        this.server = new Server();
        this.server.start(3102);
    });

    beforeEach(async () => {
        clientSocket = await getSocketClient(this.server,3102, process.env.ADMIN_EMAIL, process.env.ADMIN_PWD);
    });

    test("Collaboration - Start", (done) => {
        clientSocket.on("collabStart", (data) => {
            expect(data).toHaveProperty("collabHash");
            expect(data).toHaveProperty("collabId");
            done();
        });
        clientSocket.emit("documentSubscribe", {documentId: 1});
        clientSocket.emit('collabUpdate', {
            targetType: "comment",
            targetId: 1,
            documentId: 1,
            collabHash: "test"
        });
    });

    test("Collaboration - User", (done) => {
        clientSocket.on("collabRefresh", (data) => {
            expect(data.collabHash).toBe("test");
            done();
        });
        clientSocket.emit("documentSubscribe", {documentId: 1});
        clientSocket.emit('collabUpdate', {
            targetType: "comment",
            targetId: 1,
            documentId: 1,
            collabHash: "test"
        });
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