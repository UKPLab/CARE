const Server = require("../webserver/Server.js");
const {getSocketClient} = require("./utils.js");

describe("Test Websockets - Annotations", () => {
    let clientSocket;

    beforeAll(async () => {
        this.server = new Server();
        this.server.start(3101);
    });

    beforeEach(async () => {
        clientSocket = await getSocketClient(this.server, 3101, process.env.ADMIN_EMAIL, process.env.ADMIN_PWD);
    });

    test("Add and update annotation", (done) => {
        clientSocket.on("annotationRefresh", (data) => {
            expect(data.length).toBeGreaterThan(0);
            if (data.find((t) => t.documentId === 1)['tagId'] === 2) {
                done();
            } else {
                clientSocket.emit("annotationUpdate", {annotationId: 1, tagId: 2})
            }

        })
        clientSocket.emit("documentSubscribe", {documentId: 1}) // add annotation
        clientSocket.emit("annotationUpdate", {documentId: 1, tagId: 1}) // add annotation
    })

    afterEach(() => {
        if (clientSocket.connected) {
            clientSocket.disconnect();
        }
    });

    afterAll(async () => {
        this.server.stop();
    });

});