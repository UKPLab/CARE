/* webServer.js - Defines Express Webserver of Content Server

This module is the heart of the content server. Here the server is configured and
started. The content server uses express to provide the routes found in the
subdirectory "routes", the sockets in "sockets" and the front-end compiled into
the "dist" directory.

Author: Dennis Zyska (zyska@ukp.informatik....)
Co-Author: Nils Dycke (dycke@ukp.informatik...)
Source: --
*/

'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');

const {Server} = require("socket.io");
const {createServer, useSsl} = require('./createServer');
const cors = require('cors');

const passport = require("passport");
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const bodyParser = require('body-parser');

// define PATHs
const BUILD_PATH = `${__dirname}/../../dist/`;
const port = process.env.CONTENT_SERVER_PORT || 3001;

// define logger
// check logging dir exists
if (!fs.existsSync(process.env.LOGGING_PATH)){
  fs.mkdirSync(process.env.LOGGING_PATH, { recursive: true });
}
const logger = require("../utils/logger.js")( "webServer");

// routes
const routes = [
    require("./routes/auth"),
];

// sockets
const sockets = [
    require("./sockets/annotation"),
    require("./sockets/documents"),
    require("./sockets/log"),
];

/**
 * The main HTTP server which serves all files to the client
 *
 */
function webServer(config) {
    logger.debug("Start Webserver...")
    const app = express()

    // enable CORS in Dev Mode
    if (process.env.BACKEND_ENABLE_CORS === 'true') {
        logger.debug("Use CORS Restriction with origin: http://localhost:3000");
        app.use(cors({origin: 'http://localhost:3000', credentials: true}));
    }

    // Make all static files public available
    app.use(express.static(BUILD_PATH));

    // Session Initialization
    const sessionMiddleware = session({
        /*genid: (req) => {
            console.log('Inside session middleware genid function')
            console.log(`Request object sessionID from client: ${req.sessionID}`)
            return uuidv4(); // use UUIDs for session IDs
        },*/
        store: new FileStore(), secret: 'thatsecretthinggoeshere', resave: false, saveUninitialized: true
    });
    app.use(sessionMiddleware);
    app.use(bodyParser.urlencoded({extended: false}));
    app.use(bodyParser.json());
    app.use(passport.initialize());
    app.use(passport.session());

    logger.debug("Initialize Routes...");
    routes.forEach(route => route(app));

    // all further urls reference to frontend
    app.use("/*", express.static(`${__dirname}/../../dist/index.html`));

    // add websocket server socket.io
    const httpServer = createServer(app);
    // enable CORS in Dev Mode
    let socketIoOptions = {
        maxHttpBufferSize: 1e8 // 100 MB for file upload
    };
    if (process.env.BACKEND_ENABLE_CORS === 'true') {
        socketIoOptions = {
            cors: {
                origin: "http://localhost:3000", methods: ["GET", "POST"], credentials: true,
            }, origins: ['http://localhost:3000'], handlePreflightRequest: (req, res) => {
                const headers = {
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                    "Access-Control-Allow-Origin": req.headers.origin, //or the specific origin you want to give access to,
                    "Access-Control-Allow-Credentials": true
                };
                res.writeHead(200, headers);
                res.end();
            }, maxHttpBufferSize: 1e8 // 100 MB for file upload
        };
    }

    logger.debug("Initialize Websocket...");
    const io = new Server(httpServer, socketIoOptions);
    const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
    io.use(wrap(sessionMiddleware));
    io.use(wrap(passport.initialize()));
    io.use(wrap(passport.session()));
    io.on("connection", (socket) => {
        // Check if session exists, otherwise send logout and disconnect
        if (!socket.request.session.passport) {
            logger.warn("Session in websocket not available! Send logout...");
            socket.emit("logout"); //force logout on client side
            socket.disconnect();
        } else {
            socket.request.session.touch();
        }
    });
    logger.debug("Initialize Sockets...");
    sockets.forEach(socket => socket(io));

    // serve server on port
    httpServer.listen(config.port, () => {
        const scheme = useSsl ? 'https' : 'http';
        logger.info(`Web Server started at ${scheme}://localhost:${config.port}/`)
    });
}




webServer({port: port});