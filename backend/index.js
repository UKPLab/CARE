const port = process.env.CONTENT_SERVER_PORT || 3001;

const webserver = require("./webserver/webServer.js");

module.exports = webserver({port: port});