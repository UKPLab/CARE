const Server = require("../webserver/Server.js");
const {getSocketClient} = require("./utils.js");

describe("Test Websockets - Annotations", () => {
    let clientSocket;

    beforeAll(async () => {
        this.server = new Server();
        this.server.start(3010);
    });

    beforeEach(async () => {
        clientSocket = await getSocketClient(this.server, process.env.ADMIN_EMAIL, process.env.ADMIN_PWD);
        this.server.db.sequelize.sync();
    });

    test("Add and update annotation", (done) => {
        clientSocket.on("annotationRefresh", (data) => {
            console.log("annotaiton", data);
            expect(data.length).toBeGreaterThan(0);
            expect(data.find((t) => t.documentId === 1)['tagId']).toBe(1);
            clientSocket.emit("annotationUpdate", {annotationId: 1, tagId: 2})
            // TODO implement, check if annotation is updated
            // TODO add delete annotation
            // TODO think to subscribe document
            done();
        })
        clientSocket.emit("annotationUpdate", {documentId: 1, tagId: 1}) // add annotation
    })

    test("Add Page Note", (done) => {
        // TODO implement, add page note
        done();
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