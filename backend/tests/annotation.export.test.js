const webserver = require('../webserver/webServer.js')
const {io:io_client} = require("socket.io-client");
const request = require('request');
const requestt = require('supertest')

describe('Annotation Exporting Test', () => {
    let ioClient, app, httpServer;

    beforeAll((done) => {
        [app, httpServer] = webserver();
        httpServer.listen(3001, () => console.log("Started test server"));

        //login as admin
        request.post(
            'http://localhost:3001/auth/login',
            { json: {
                username: "admin",
                password: "admin",
              }
            },
            function (error, response, body) {
                if (!error && response.statusCode === 200) {
                    const sid = response.headers["set-cookie"][0];

                    var opts = {
                        transportOptions: {
                            polling: {
                                extraHeaders: {
                                    'Cookie': sid
                                }
                            }
                        },
                        withCredentials: true
                    };

                    // setup ioClient
                    ioClient = io_client(`http://localhost:3001`, opts);
                    ioClient.on("toast", (data) => {
                        expect(false, `server returned an error code: ${data}`);
                    });
                    ioClient.on("connect", done);

                    //connect
                    ioClient.connect();
                } else {
                    throw Error(`Cannot start test due to failed login. Error msg: ${body}`);
                }
            }
        );
    });

    it('expects the exported annotations', (done) => {
        ioClient.on("exportedAnnotations", (data) => {
            expect("success" in data && data["success"]);
            expect("csvs" in data && "docids" in data);

            const blobs = data["csvs"];
            const docids = data["docids"];

            done();
        });
        ioClient.emit("exportAnnotations", ["8852a746-360e-4c31-add2-4d1c75bfb96d"]);
    });

    afterAll(() => {
        ioClient.close()
    });
})
