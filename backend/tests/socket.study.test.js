const Server = require("../webserver/Server.js");
const {getSocketClient} = require("./utils.js");

describe("Test Websockets - Studies", () => {
    let clientSocket;

    beforeAll(async () => {
        this.server = new Server();
        this.server.start(3109);
    });

    beforeEach(async () => {
        clientSocket = await getSocketClient(this.server,3109, process.env.ADMIN_EMAIL, process.env.ADMIN_PWD);
    });


    // // NOTE: commented out because 'studyPublish' was not used anywhere else, and got removed
    // test("Add Study - Get study by Hash", (done) => {
    //     clientSocket.on("studyRefresh", (data) => {
    //         expect(data.find(study => study.name === "Test Study")).toBeTruthy();
    //         done();
    //     })
    //     clientSocket.on("studyPublished", (data) => {
    //         expect(data).toHaveProperty("success", true);
    //         clientSocket.emit("studyGetByHash", {studyHash: data['studyHash']})
    //     })
    //     clientSocket.emit("studyPublish", {
    //         name: "Test Study",
    //         documentId: 1,
    //     });
    // });

    // // NOTE: commented out because 'studyGetAll' was not used anywhere else, and got removed
    // test("Add Session to study", (done) => {
    //     clientSocket.on("study_sessionRefresh", (data) => {
    //         expect(data.length).toBeGreaterThan(0);
    //         done();
    //     })
    //     clientSocket.on("studyPublished", (data) => {
    //         expect(data).toHaveProperty("success", true);
    //         clientSocket.emit("studyGetAll")
    //     })
    //     clientSocket.emit("studyPublish", {
    //         name: "Test Study 2",
    //         documentId: 1,
    //     });
    // })

    afterEach(() => {
        if (clientSocket.connected) {
            clientSocket.disconnect();
        }
    });

    afterAll(async () => {
        this.server.stop();
    });

});