const Server = require("../webserver/Server.js");
const {getSocketClient} = require("./utils.js");

describe("Test Websockets - Comments", () => {
    let clientSocket;

    beforeAll(async () => {
        this.server = new Server();
        this.server.start(3010);
    });

    beforeEach(async () => {
        clientSocket = await getSocketClient(this.server, process.env.ADMIN_EMAIL, process.env.ADMIN_PWD);
    });

    test("Add and update comments", (done) => {
        clientSocket.on("commentRefresh", (data) => {
            expect(data.find((t) => t.documentId === 1)['documentId']).toBe(1);
            if (data.find((t) => t.text === "addAndUpdateTest")) {
                expect(data.find((t) => t.text === "addAndUpdateTest")['documentId']).toBe(1);
                done();
            } else {
                clientSocket.emit("commentUpdate", {
                    commentId: data.find((t) => t.documentId === 1)['id'],
                    documentId: 1,
                    text: "addAndUpdateTest"
                })
            }

        })
        clientSocket.emit("documentSubscribe", {documentId: 1}) // add annotation
        clientSocket.emit("commentUpdate", {documentId: 1, tagId: 1}) // add annotation
    })

    test("Get Comment by Document", (done) => {
        clientSocket.on("commentRefresh", (data) => {
            if (data.find((t) => t.text === "test")) {
                expect(data.find((t) => t.text === "test")['documentId']).toBe(1);
                done();
            }
        })
        clientSocket.emit("commentUpdate", {documentId: 1, text: "test"}) // add annotation
        clientSocket.emit("documentSubscribe", {documentId: 1}) // add annotation
        clientSocket.emit("commentGetByDocument", {documentId: 1})
    });

    test("Add Comment by bot", (done) => {
        clientSocket.on("commentRefresh", (data) => {
            expect(data.length).toBeGreaterThan(0);
            if (data.find((t) => t.text === "test2")) {
                clientSocket.emit("commentUpdate", {
                    parentCommentId: data.find((t) => t.text === "test2")['id'],
                    documentId: 1,
                    userId: 'Bot'
                }) // add annotation
            } else {
                expect(data[0]['parentCommentId']).toBeGreaterThan(0);
                done();
            }

        })
        clientSocket.emit("documentSubscribe", {documentId: 1}) // add annotation
        clientSocket.emit("commentUpdate", {documentId: 1, text: "test2"}) // add annotation
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