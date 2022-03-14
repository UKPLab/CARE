'use strict';

const path = require('path');
const express = require('express');
const mustacheExpress = require('mustache-express');

const { createServer, useSsl } = require('./createServer');

const HTML_PATH = `${__dirname}/html/`;

/**
 * The main HTTP server which serves all files to the client
 *
 * @param {number} port - The port that the webserver should listen on.
 */
function webServer(port) {
    const app = express()

    //Set up engine framework
    app.engine('mustache', mustacheExpress())
    app.set('view engine', 'mustache');
    app.set('views', [path.join(HTML_PATH, '/templates')]);

    // Make all static files public available
    app.use(express.static(path.join(HTML_PATH, 'static')));



    // serve server on port
    createServer(app).listen(port, () => {
       const scheme = useSsl ? 'https':'http';
       console.log(`Web Server started at ${scheme}://localhost:${port}/`)
    });
}

module.exports = webServer