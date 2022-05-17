'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const mustacheExpress = require('mustache-express');

const { Server } = require("socket.io");
const { createServer, useSsl } = require('./createServer');

const passport = require("passport");
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const bodyParser = require('body-parser');

// define PATHs
const TEMPLATES_PATH = `${__dirname}/../templates/`;
const BUILD_PATH = `${__dirname}/../../dist/`;

// routes
const routes = [
    require("./routes/auth"),  //has to be first to make sure, session is available in req
    require("./routes/pdf"),
    require("./routes/hypothesis"),
    require("./routes/api"),
];

// sockets
const sockets = [
    require("./sockets/basic")
];

/**
 * The main HTTP server which serves all files to the client
 *
 * @param {{port: number, page: {subtitle: string, title: string}}} config - The port that the webserver should listen on.
 */
function webServer(config) {
    const app = express()

    //Set up engine framework
    app.engine('mustache', mustacheExpress())
    app.set('view engine', 'mustache');
    app.set('views', TEMPLATES_PATH);

    // Make all static files public available
    app.use(express.static(BUILD_PATH));

    // Session Initialization
    app.use(session({
        /*genid: (req) => {
            console.log('Inside session middleware genid function')
            console.log(`Request object sessionID from client: ${req.sessionID}`)
            return uuidv4(); // use UUIDs for session IDs
        },*/
        store: new FileStore(), //TODO store session data into database
        secret: 'thatsecretthinggoeshere',
        resave: false,
        saveUninitialized: true
    }));
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());
    app.use(passport.initialize());
    app.use(passport.session());

    // additional routes from routes directory
    routes.forEach(route => route(app));

    // all further urls reference to frontend
    app.use("/*", express.static(`${__dirname}/../../dist/index.html`));

    // add websocket server socket.io
    const httpServer = createServer(app);
    const io = new Server(httpServer, {
        //options
    })
    sockets.forEach(socket => socket(io));

    // serve server on port
    httpServer.listen(config.port, () => {
        const scheme = useSsl ? 'https' : 'http';
        console.log(`Web Server started at ${scheme}://localhost:${config.port}/`)
    });
}

webServer({port:process.env.CONTENT_SERVER_PORT});