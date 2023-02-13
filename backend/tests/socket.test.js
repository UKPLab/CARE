const request = require('supertest')
const Init = require("../index.js");
const {io: Client} = require("socket.io-client");
const Server = require("../webserver/Server.js");
const fs = require("fs");

const COOKIE_NAME = "connect.sid";

describe("Test Websockets", () => {
    let clientSocket;
    beforeAll(async () => {
        this.server = new Server();
        this.server.start(3010);
    });

    beforeEach(async () => {
        const res = await request(this.server.http)
            .post('/auth/login')
            .send({
                username: process.env.ADMIN_EMAIL,
                password: process.env.ADMIN_PWD,
            })
        const cookie = res.header['set-cookie'][0];
        if (res.statusCode !== 200) {
            throw new Error("Could not login");
        }

        const options = {
            transportOptions: {
                polling: {
                    extraHeaders: {
                        'Cookie': cookie
                    }
                }
            },
            reconnection: true,
            autoConnect: true,
            timeout: 1000,
        }

        clientSocket = Client("http://localhost:3010", options);
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

    test("Load Logs", (done) => {
        clientSocket.on("logAll", (data) => {
            expect(Array.isArray(data)).toBe(true);
            done();
        })
        clientSocket.emit("logGetAll", {limit: 100})
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

    test("Send Toasts", (done) => {
        // TODO implement
        done();
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
                    data: {
                        id: 1,
                        name: "sentiment_classification",
                        data: {}
                    }
                });
            }
            if (data['type'] === 'skillResults') {
                console.log(data);
                // TODO implement
                expect(data['data'].length).toBeGreaterThan(0);

            }


        })
        clientSocket.emit("serviceCommand", {service: "NLPService", command: "skillGetAll", data: {}});
    });


    test("Get User Data", (done) => {
        clientSocket.on("userData", (data) => {
            expect(data.success).toBe(true);
            expect(data.users.length).toBeGreaterThan(0);
            done();
        })
        clientSocket.emit("userGetData")
    });

    afterEach(() => {
        clientSocket.disconnect();
    });

    afterAll(async () => {
        this.server.stop();
    });

});