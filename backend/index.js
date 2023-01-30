/* Entry Point of the Backend

Author: Dennis Zyska (zyska@ukp.informatik....)
Source: --
*/
const serverPort = process.env.CONTENT_SERVER_PORT || 3001;
const Server = require("./webserver/Server.js");

// check logging dir exists
const fs = require("fs");
if (!fs.existsSync(process.env.LOGGING_PATH || "./logs")) {
    fs.mkdirSync(process.env.LOGGING_PATH || "./logs", {recursive: true});
}

const server = new Server();
server.start(serverPort);