/* Entry Point of the Backend

Author: Dennis Zyska (zyska@ukp.informatik....)
Source: --
*/
const port = process.env.CONTENT_SERVER_PORT || 3001;

const webserver = require("./webserver/webServer.js");
const {useSsl} = require("./webserver/createServer");

const [app, httpServer] = webserver();
const logger = require("./utils/logger.js")("index");

// serve server on port
httpServer.listen(port, () => {
    const scheme = useSsl ? 'https' : 'http';
    logger.info(`Web Server started at ${scheme}://localhost:${port}/`)
});