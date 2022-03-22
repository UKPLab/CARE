'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const mustacheExpress = require('mustache-express');

const { createServer, useSsl } = require('./createServer');

const HTML_STATIC_PATH = `${__dirname}/../../html/`;
const TEMPLATES_PATH = `${__dirname}/../templates/`;
const BUILD_PATH = `${__dirname}/../../build/`;

// routes
const routes = [
    require("./routes/upload"),
    require("./routes/annotate"),
    require("./routes/hypothesis")
]

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
    app.use(express.static(HTML_STATIC_PATH));
    // And also the build files
    app.use(express.static(BUILD_PATH));

    // additional routes from routes directory
    routes.forEach(route => app.use(route))

    // Landing Page
    app.get('/', (req, res) => {
        res.render('index', config);
    });

    // Error pages
    app.use((req, res) => {
        res.render('404');
    });

    // serve server on port
    createServer(app).listen(config.port, () => {
       const scheme = useSsl ? 'https':'http';
       console.log(`Web Server started at ${scheme}://localhost:${config.port}/`)
    });
}

module.exports = webServer