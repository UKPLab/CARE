const Server = require("../webserver/Server.js");
const {getSocketClient} = require("./utils.js");

describe("Test Websockets - Service - NLP", () => {
    let clientSocket;

    beforeAll(async () => {
        this.server = new Server();
        this.server.start(3106);
    });

    beforeEach(async () => {
        clientSocket = await getSocketClient(this.server,3106, process.env.ADMIN_EMAIL, process.env.ADMIN_PWD);
    });

    test("Service - NLP Service", (done) => {
        clientSocket.on("serviceRefresh", (data) => {
            if (data['type'] === 'skillUpdate') {
                expect(data['type']).toBe("skillUpdate");
                expect(data['service']).toBe("NLPService");
                expect(data['data'].length).toBeGreaterThan(0);
                expect(data['data'].filter(d => d.name === 'sentiment_classification').length).toBeGreaterThan(0);
                clientSocket.emit("serviceCommand", {
                    service: "NLPService",
                    command: "skillGetConfig",
                    data: {name: "sentiment_classification"}
                });
            }
            if (data['type'] === 'skillConfig') {
                expect(data['type']).toBe("skillConfig");
                expect(data['data']['name']).toBe("sentiment_classification");
                clientSocket.emit("serviceRequest", {
                    service: "NLPService",
                    data: {
                        id: 1,
                        name: "sentiment_classification",
                        data: {}
                    }
                });
            }
            if (data['type'] === 'skillResults') {
                expect(data['data']['id']).toBe(1);
                expect(data['data']['fallback']).toBe(true);
                done();
            }
        })
        // It is auto called when client connects to server
        // clientSocket.emit("serviceCommand", {service: "NLPService", command: "skillGetAll", data: {}});
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