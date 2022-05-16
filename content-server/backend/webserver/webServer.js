'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const mustacheExpress = require('mustache-express');

const { Server } = require("socket.io");
const { createServer, useSsl } = require('./createServer');

// define PATHs
const TEMPLATES_PATH = `${__dirname}/../templates/`;
const BUILD_PATH = `${__dirname}/../../dist/`;

// routes
const routes = [
    require("./routes/hypothesis"),
    require("./routes/auth"),
    require("./routes/user"),
    require("./routes/api"),
    require("./routes/pdf")
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