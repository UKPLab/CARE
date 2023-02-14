const Server = require("../webserver/Server.js");
const {getSocketClient} = require("./utils.js");

describe("Test Websocket - Tags", () => {
    let clientSocket;

    beforeAll(async () => {
        this.server = new Server();
        this.server.start(3010);
    });

    beforeEach(async () => {
        clientSocket = await getSocketClient(this.server, process.env.ADMIN_EMAIL, process.env.ADMIN_PWD);
        this.server.db.sequelize.sync();
    });


    test("Load tags", (done) => {
        clientSocket.on("tagRefresh", (data) => {
            expect(data.length).toBeGreaterThan(0);
            expect(data.filter((t) => t.tagSetId === 1).length).toBeGreaterThan(0);
            done();
        })
        clientSocket.emit("tagGetAll")
    });

    test("Load tags by User", (done) => {
        // TODO implement, login with guest user and check if tags are loaded
        done();
    })

    test("Load tagSets", (done) => {
        clientSocket.on("tagSetRefresh", (data) => {
            expect(data.length).toBeGreaterThan(0);
            expect(data.find((t) => t.id === 1)['creator_name']).toBe("System");
            done();
        })
        clientSocket.emit("tagSetGetAll")
    });

    test("Load tagSets by User", (done) => {
        // TODO implement, login with guest user and check if tagSets are loaded
        done();
    })

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
            console.log("tagSetRefresh", data);
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