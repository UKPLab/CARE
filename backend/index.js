const port = process.env.CONTENT_SERVER_PORT || 3001;

const webserver = require("./webserver/webServer.js");
const {useSsl} = require("./webserver/createServer");

const app = webserver();
const logger = require("./utils/logger.js")( "index");

// serve server on port
app.listen(port, () => {
    const scheme = useSsl ? 'https' : 'http';
    logger.info(`Web Server started at ${scheme}://localhost:${port}/`)
});