const Server = require("../webserver/Server.js");
const {getSocketClient} = require("./utils.js");

describe("Test Websocket - Tags", () => {
    let clientSocket;

    beforeAll(async () => {
        this.server = new Server();
        this.server.start(3110);
    });

    beforeEach(async () => {
        clientSocket = await getSocketClient(this.server,3110, process.env.ADMIN_EMAIL, process.env.ADMIN_PWD);
    });


    test("Load tags", (done) => {
        clientSocket.on("tagRefresh", (data) => {
            expect(data.length).toBeGreaterThan(0);
            expect(data.filter((t) => t.tagSetId === 1).length).toBeGreaterThan(0);
            done();
        })
        clientSocket.emit("tagGetAll")
    });

    test("Load tagSets", (done) => {
        clientSocket.on("tagSetRefresh", (data) => {
            expect(data.length).toBeGreaterThan(0);
            expect(data.find((t) => t.id === 1)['creator_name']).toBe("System");
            done();
        })
        clientSocket.emit("tagSetGetAll")
    });

    test("TagSet Add / Publish", (done) => {
        clientSocket.on("tagSetPublished", (data) => {
            expect(data.success).toBe(true);
            done();
        });
        clientSocket.on("tagSetRefresh", (data) => {
            expect(data.find((t) => t.name === 'TestTagSet')['id']).toBeGreaterThan(0);
            clientSocket.emit("tagSetPublish", {tagSetId: data.find((t) => t.name === 'TestTagSet')['id']})
        });
        clientSocket.emit("tagSetUpdate", {
            "tagSetId": 0,
            "tagSet": {
                "id": 0,
                "name": "TestTagSet",
                "description": "",
            },
            "tags": []
        })
    });

    test("TagSet Update", (done) => {
        clientSocket.on("tagSetRefresh", (data) => {
            expect(data.find((t) => t.name === 'ChangeName')['id']).toBe(1);
            done();
        });
        clientSocket.emit("tagSetUpdate", {
            "tagSetId": 1,
            "tagSet": {
                "name": "ChangeName",
            },
            "tags": []
        })
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