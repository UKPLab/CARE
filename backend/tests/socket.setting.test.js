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
        this.server.db.sequelize.sync();
    });

    test("Test Settings", (done) => {
        clientSocket.on("settingRefresh", (data) => {
            expect(data["tags.tagSet.default"]).toBe("1");
            done();
        })
        clientSocket.emit("settingGetAll")
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
            expect(Object(data).keys().length).toBeGreaterThan(0);
            done();
        })
        clientSocket.emit("settingGetAll")
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