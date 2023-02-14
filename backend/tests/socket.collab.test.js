const Server = require("../webserver/Server.js");
const {getSocketClient} = require("./utils.js");

describe("Test Websockets - Collaboration", () => {
    let clientSocket;

    beforeAll(async () => {
        this.server = new Server();
        this.server.start(3010);
    });

    beforeEach(async () => {
        clientSocket = await getSocketClient(this.server, process.env.ADMIN_EMAIL, process.env.ADMIN_PWD);
        this.server.db.sequelize.sync();
    });

    test("Collaboration", (done) => {
        clientSocket.on("collabStart", (data) => {
            console.log("collabStar", data);
            console.log("collabStar", data);
            console.log("collabStar", data);
            //TODO implement
            done();
        });
        clientSocket.emit("collabSubscribe", {documentId: 1});
        clientSocket.emit('collabAdd', {
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