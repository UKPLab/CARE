/**
 * Entry Point of the Backend
 *
 * @author Dennis Zyska
 */
const serverPort = process.env.CONTENT_SERVER_PORT || 3001;
const Server = require("./webserver/Server");
const path = require("path");
const UPLOAD_PATH = path.join(__dirname, "..", "files");

// check logging dir exists
const fs = require("fs");
if (!fs.existsSync(process.env.LOGGING_PATH || "./logs")) {
  fs.mkdirSync(process.env.LOGGING_PATH || "./logs", { recursive: true });
}

// check upload dir exists
if (!fs.existsSync(UPLOAD_PATH)) {
  fs.mkdirSync(UPLOAD_PATH, { recursive: true });
}

const server = new Server();
server.start(serverPort);