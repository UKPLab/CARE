const Server = require("../webserver/Server.js");
const {getSocketClient} = require("./utils.js");

describe("Test Websockets - Settings", () => {
    let clientSocket;

    beforeAll(async () => {
        this.server = new Server();
        this.server.start(3010);
    });

    beforeEach(async () => {
        clientSocket = await getSocketClient(this.server, process.env.ADMIN_EMAIL, process.env.ADMIN_PWD);
    });

    test("Save Setting", (done) => {
        clientSocket.on("settingData", (data) => {
            if (data.find(s => s.key === "test")['value'] !== "test") {
                expect(data.find(s => s.key === "test")['value']).toBe("test2");
                done();
            } else {
                expect(data.find(s => s.key === "test")['value']).toBe("test");
                clientSocket.emit("settingSave", [{key: "test", value: "test2"}])
            }
        })
        clientSocket.emit("settingSave", [{key: "test", value: "test"}])
    });

    test("Load Settings", (done) => {
        clientSocket.on("settingRefresh", (data) => {
            expect('app.study.enabled' in data).toBe(true);
            expect(data["service.nlp.token"]).toBe(undefined);
            done();
        })
        clientSocket.emit("settingGetAll")
    });

    test("Load All Settings", (done) => {
        clientSocket.on("settingRefresh", (data) => {
            expect('app.study.enabled' in data).toBe(true);
            done();
        })
        clientSocket.emit("settingGetAll", true)
    });

    test("Setting Configuration", (done) => {
        clientSocket.on("settingData", (data) => {
            expect(data.find(s => s.key  === "service.nlp.token").value).toBe(process.env.SERVICE_NLP_TOKEN);
            done();
        })
        clientSocket.emit("settingGetData")
    });

    test("Test Navigation", (done) => {
        clientSocket.on("settingNavigation", (data) => {
            expect(data.groups.length).toBeGreaterThan(0);
            expect(data.elements.length).toBeGreaterThan(0);
            done();
        })
        clientSocket.emit("settingGetNavigation")
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