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

const {Server: WebSocketServer} = require("socket.io");
const http = require('http');
const cors = require('cors');

const passport = require("passport");
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const bodyParser = require('body-parser');
const Socket = require('./Socket.js');
const Sequelize = require('sequelize');
const db = require("../db");
const {DataTypes} = require("sequelize");
const SequelizeStore = require('connect-session-sequelize')(session.Store);

module.exports = class Server {
    constructor() {
        this.logger = require("../utils/logger.js")("webServer");
        this.app = express();

        this.sockets = {};
        this.services = {};
        this.socket = null;

        // No Caching
        this.app.disable('etag');
        this.#setCors()
        // Make all static files public available
        this.app.use(express.static(`${__dirname}/../../dist/`));

        this.logger.info("Initializing Session management...");
        this.session = this.#initSessionManagement();
        this.app.use(this.session);

        this.logger.info("Initializing Passport...");
        this.app.use(bodyParser.urlencoded({extended: false}));
        this.app.use(bodyParser.json());
        this.app.use(passport.initialize());
        this.app.use(passport.session());

        // Routes for login management
        this.logger.debug("Initialize Routes for auth...");
        require("./routes/auth")(this.app);

        // all further urls reference to frontend
        this.app.use("/*", express.static(`${__dirname}/../../dist/index.html`));

        this.httpServer = http.createServer(this.app);
        this.#initWebsocketServer();
    }

    #setCors() {
        this.logger.debug("Use CORS Restriction");
        this.app.use(cors({
            origin: ['http://localhost:3000', "http://localhost:8080", 'https://peer.ukp.informatik.tu-darmstadt.de'],
            credentials: true
        }));
    }

    #initSessionManagement() {

        // Define Session Model Table
        db.sequelize.define("session", {
            sid: {
                type: Sequelize.STRING,
                primaryKey: true,
            },
            userId: Sequelize.STRING,
            expires: Sequelize.DATE,
            data: Sequelize.TEXT,
        });

        // Sync Session Table
        db.sequelize.sync();

        // Sequelize Session Store
        this.logger.info("Initializing Sequelize Session Store...");
        const dbStore = new SequelizeStore({
            db: db.sequelize,
            checkExpirationInterval: 15 * 60 * 1000, // The interval at which to cleanup expired sessions in milliseconds.
            expiration: 24 * 60 * 60 * 1000  // The maximum age (in milliseconds) of a valid session.
        });
        dbStore.sync();

        //Session management
        return session({
            secret: "secretString",
            store: dbStore,
            resave: false,
            proxy: true,
            saveUninitialized: true,
        })

    }

    /**
     * Initialize the websocket server instance
     */
    #initWebsocketServer() {
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

        this.io = new WebSocketServer(this.httpServer, socketIoOptions);
        const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
        this.io.use(wrap(this.session));
        this.io.use(wrap(passport.initialize()));
        this.io.use(wrap(passport.session()));
        this.socket = this.io.on("connection", (socket) => {
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
            return socket;
        });
    }

    /**
     *
     * Add new sockets route of class Socket
     *
     * @param socketClass - class of the socket
     */
    addSocket(socketClass) {
        this.logger.info("Add socket " + socketClass.name + " to webserver...");
        this.io.on("connection", (socket) => {
            this.sockets[socketClass.name] = new socketClass(this, this.io, socket);
            this.sockets[socketClass.name].init();
        });
    }

    /**
     * Add external services to the server
     */
    addService(serviceClass) {
        this.logger.info("Add service " + serviceClass.name + " to webserver...");

        this.services[serviceClass.name] = new serviceClass(this);
        this.services[serviceClass.name].init();

    }

    start(port) {
        this.logger.debug("Start Webserver...");
        this.httpServer.listen(port, () => {
            this.logger.info("Server started on port " + port);
        });
    }

}