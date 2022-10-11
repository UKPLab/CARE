const webserver = require("../../webserver/webServer");
const request = require("request");
const {io: io_client} = require("socket.io-client");

const PORT = process.env.CONTENT_SERVER_PORT || 3001;
const HOST = "localhost";
const ADMIN_PWD = process.env.ADMIN_PWD || "admin";

exports.setupTestSocket = function(done_cb) {
    // setup http server
    const [app, httpServer] = webserver();

    httpServer.listen(3001, () => {
        console.log("Started test server")

        //login as admin
        request.post(
            `http://${HOST}:${PORT}/auth/login`,
            { json: {
                username: "admin",
                password: ADMIN_PWD,
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
                    ioClient = io_client(`http://${HOST}:${PORT}`, opts);

                    // error handling
                    ioClient.on("toast", (data) => {
                        expect(false, `server returned an error code: ${data}`);
                    });

                    //done on connect
                    ioClient.on("connect", () => {
                        console.log("ioClient connected");
                        done_cb(ioClient);
                    });

                    //connect
                    ioClient.connect();
                } else {
                    throw Error(`Cannot setup test socket due to failed login. Error msg: ${body}`);
                }
            }
        );
    });

    return [app, httpServer]
}

exports.tearDownTestSocket = function(httpServer, socket){
    try {
        socket.disconnect();
        console.log("IOClient teared down");
    } catch (e) {
        console.log("Error during IOClient tear down");
        console.error(e.toString());
    }
    try {
        httpServer.close();
        console.log("HTTPServer teared down");
    } catch (e) {
        console.log("Error during HTTPServer tear down");
        console.error(e.toString());
    }
}