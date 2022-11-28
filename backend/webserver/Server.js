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

const express = require('express');

const {Server} = require("socket.io");
const http = require('http');
const cors = require('cors');

const passport = require("passport");
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const bodyParser = require('body-parser');

module.exports = class Server {
    constructor() {
        this.logger = require("../utils/logger.js")("webServer");
        this.app = express();

        // No Caching
        this.app.disable('etag');
        this.#set_cors()
        // Make all static files public available
        this.app.use(express.static(`${__dirname}/../../dist/`));

        //Session management
        this.sessionMiddleware = this.#init_session_management();
        this.app.use(this.sessionMiddleware);
        this.app.use(bodyParser.urlencoded({extended: false}));
        this.app.use(bodyParser.json());
        this.app.use(passport.initialize());
        this.app.use(passport.session());

        // Routes for login management
        this.logger.debug("Initialize Routes for auth...");
        require("./routes/auth")(app);

        // all further urls reference to frontend
        this.app.use("/*", express.static(`${__dirname}/../../dist/index.html`));

        this.httpServer = http.createServer(this.app);
        this.#init_websockets();

    }

    #set_cors() {
        this.logger.debug("Use CORS Restriction");
        this.app.use(cors({
            origin: ['http://localhost:3000', "http://localhost:8080", 'https://peer.ukp.informatik.tu-darmstadt.de'],
            credentials: true
        }));
    }

    #init_session_management() {
        return session({
            store: new FileStore(),
            secret: 'thatsecretthinggoeshere',
            resave: false,
            saveUninitialized: true,
            /*cookie:{
                maxAge: 1000*60*90
            }*/
        });

    }

    #init_websockets() {
        this.logger.debug("Initialize Websockets...");
        const socketIoOptions = {
            cors: {
                origin: ["http://localhost:3000", 'http://localhost:8080', 'https://peer.ukp.informatik.tu-darmstadt.de'],
                methods: ["GET", "POST"],
                credentials: true,
            },
            origins: ['http://localhost:3000', 'http://localhost:8080', 'https://peer.ukp.informatik.tu-darmstadt.de'],
            handlePreflightRequest: (req, res) => {
                const headers = {
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                    "Access-Control-Allow-Origin": req.headers.origin, //or the specific origin you want to give access to,
                    "Access-Control-Allow-Credentials": true
                };
                res.writeHead(200, headers);
                res.end();
            },
            maxHttpBufferSize: 1e8 // 100 MB for file upload
        };

        this.io = new Server(this.httpServer, socketIoOptions);
        const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
        this.io.use(wrap(this.sessionMiddleware));
        this.io.use(wrap(passport.initialize()));
        this.io.use(wrap(passport.session()));
        this.io.on("connection", (socket) => {
            // Check if session exists, otherwise send logout and disconnect
            if (!socket.request.session.passport) {
                try {
                    socket.request.session.destroy();
                    this.logger.warn("Session in websocket not available! Send logout...");
                    socket.emit("logout"); //force logout on client side
                    socket.disconnect();
                } catch (e) {
                    this.logger.debug("Websocket: Session not available + ", e);
                }
            }
            socket.onAny(() => {
                socket.request.session.touch();
                socket.request.session.save();
            })
        });
    }

    add_socket(socket) {
        this.logger.debug("Add socket to webserver...");
        sockets.forEach(socket => socket(this.io));
        this.logger.debug("Adding subscriptions...");
        subscriptions.forEach(subscription => subscription(this.io))
    }

    add_service() {
        this.logger.debug("Initialize NLP Service...");
        const nlp = new NLP_Service();
        nlp.init();
        nlp_socket(this.io, nlp);
    }

    start(port) {
        this.logger.debug("Start Webserver...");
        this.httpServer.listen(port, () => {
            this.logger.info("Server started on port " + port);
        });
    }

}