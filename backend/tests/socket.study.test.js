const Server = require("../webserver/Server.js");
const {getSocketClient} = require("./utils.js");

describe("Test Websockets - Studies", () => {
    let clientSocket;

    beforeAll(async () => {
        this.server = new Server();
        this.server.start(3010);
    });

    beforeEach(async () => {
        clientSocket = await getSocketClient(this.server, process.env.ADMIN_EMAIL, process.env.ADMIN_PWD);
        this.server.db.sequelize.sync();
    });


    test("Studies", (done) => {
        clientSocket.on("studyPublished", (data) => {
            console.log("study published", data);
            console.log("lk")
            // TODO implement
            done();
        })
        clientSocket.emit("studyPublish", {
            name: "Test Study",
            documentId: 1,
            collab: false,
            resumable: true,
            timeLimit: 0,
            description: "",
            start: null,
            end: null,
        });
    });

    test("Get Study by Hash", (done) => {
        clientSocket.on("studyRefresh", (data) => {
            // TODO implement

        })
        done();
        clientSocket.emit("studyGetByHash", {hash: "test"})
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