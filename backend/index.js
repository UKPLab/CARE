/**
 * Entry Point of the Backend
 *
 * @author Dennis Zyska
 */
const serverPort = process.env.CONTENT_SERVER_PORT || 3001;
const Server = require("./webserver/Server");
const DOCUMENT_PATH = `${__dirname}/../documents`;

// check logging dir exists
const fs = require("fs");
if (!fs.existsSync(process.env.LOGGING_PATH || "./logs")) {
  fs.mkdirSync(process.env.LOGGING_PATH || "./logs", { recursive: true });
}
if (!fs.existsSync(DOCUMENT_PATH)) {
  fs.mkdirSync(DOCUMENT_PATH, { recursive: true });
}

const server = new Server();
server.start(serverPort);