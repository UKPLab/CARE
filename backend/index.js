/* Entry Point of the Backend

Author: Dennis Zyska (zyska@ukp.informatik....)
Source: --
*/
const port = process.env.CONTENT_SERVER_PORT || 3001;
const Server = require("./webserver/Server.js");
const logger = require("./utils/logger.js")("index");

// check logging dir exists
const fs = require("fs");
if (!fs.existsSync(process.env.LOGGING_PATH || "./logs")) {
    fs.mkdirSync(process.env.LOGGING_PATH || "./logs", {recursive: true});
}

logger.info("Initializing server...");
const server = new Server();

logger.info("Adding sockets: ");
fs.readdir("./webserver/sockets", (err, files) => {
    if (err) {
        logger.error("Error while reading sockets directory: " + err);
        return;
    }
    files.forEach(file => {
        if (file.endsWith(".js")) {
            const newSocket = require("./webserver/sockets/" + file);
            if (newSocket.prototype instanceof require("./webserver/Socket.js")) {
                server.addSocket(newSocket);
            }
        }
    });
});

logger.info("Adding services: ");
fs.readdir("./webserver/services", (err, files) => {
    if (err) {
        logger.error("Error while reading services directory: " + err);
        return;
    }
    files.forEach(file => {
        if (file.endsWith(".js")) {
            const newService = require("./webserver/services/" + file);
            if (newService.prototype instanceof require("./webserver/Service.js")) {
                server.addService(newService);
            }
        }
    });
});

logger.info("Starting webserver on port " + port + "...");
server.start(port);




