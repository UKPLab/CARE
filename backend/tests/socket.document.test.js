const Server = require("../webserver/Server.js");
const fs = require("fs");
const {getSocketClient} = require("./utils.js");

describe("Test Websocket - Documents", () => {
    let clientSocket;

    beforeAll(async () => {
        this.server = new Server();
        this.server.start(3010);
    });

    beforeEach(async () => {
        clientSocket = await getSocketClient(this.server, process.env.ADMIN_EMAIL, process.env.ADMIN_PWD);
        this.server.db.sequelize.sync();
    });


    test("Load Documents", (done) => {
        clientSocket.on("documentRefresh", (data) => {
            expect(data.length).toBeGreaterThan(0);
            expect(data[0].name).toBe("Showcase Document");
            done();
        })
        clientSocket.emit("documentGetAll")
    });

    test("Document Upload", (done) => {
        const FILE = `${__dirname}/../../resources/showcase.pdf`;
        clientSocket.on("uploadResult", (data) => {
            expect(data.success).toBe(true);
            done();
        })
        fs.readFile(FILE, (err, data) => {
            clientSocket.emit("uploadFile", {type: 'document', file: data, name: "testfile"})
        });
    });

    test("Document by Hash Failure", (done) => {
        clientSocket.on("documentError", (data) => {
            expect(data.documentHash).toBe("test");
            done();
        })
        clientSocket.emit("documentGetByHash", {documentHash: "test"})
    })

    test("Document get by Hash", (done) => {
        // TODO implement, document get by hash
        done();
    })

    test("Document File Load", (done) => {
        clientSocket.on("documentFile", (data) => {
            expect("file" in data).toBe(true);
            expect("document" in data).toBe(true);
            done();
        })
        clientSocket.emit("documentGet", {documentId: 1})
    });

    test("Document Handling", (done) => {
        let checkDeleted = false;
        clientSocket.on("documentRefresh", (data) => {
            expect(data.find(doc => doc.id === 1)['name']).toBe("test");
            clientSocket.emit("documentDelete", {documentId: 1})
            if (checkDeleted) {
                expect(data.find(doc => doc.id === 1)['deleted']).toBe(true);
                done();
            }
            checkDeleted = true;
        })
        clientSocket.emit("documentUpdate", {documentId: 1, name: "test"})
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