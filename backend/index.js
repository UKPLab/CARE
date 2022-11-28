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

const NLP_Service = require('./external/nlp.js');
// sockets
const sockets = [
    require("./sockets/annotation"),
    require("./sockets/documents"),
    require("./sockets/log"),
    require("./sockets/review"),
    require("./sockets/user"),
    require("./sockets/tag"),
    require("./sockets/statistic"),
    require("./sockets/settings"),
    require("./sockets/collab"),
    require("./sockets/comment"),
    require("./sockets/nlp")
];
const nlp_socket = require("./sockets/nlp");
const NLP_Service = require("./webserver/external/nlp");

const subscriptions = [
    require("./sockets/subscription/documents")
]

// TODO add sockets to server class
// TODO add external services to server class

logger.info("Starting webserver on port " + port + "...");
server.start(port);




