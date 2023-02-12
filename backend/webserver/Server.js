'use strict';

const express = require('express');

const {Server: WebSocketServer} = require("socket.io");
const http = require('http');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const passport = require("passport");
const session = require('express-session');
const bodyParser = require('body-parser');
const Sequelize = require('sequelize');
const LocalStrategy = require("passport-local");
const {relevantFields} = require("../utils/auth");
const crypto = require("crypto");
const SequelizeStore = require('connect-session-sequelize')(session.Store);

/**
 * Defines Express Webserver of Content Server
 *
 * This module is the heart of the content server. Here the server is configured and
 * started. The content server uses express to provide the routes found in the
 * subdirectory "routes", the sockets in "sockets" and the front-end compiled into
 * the "dist" directory.
 *
 * @author Dennis Zyska, Nils Dycke
 * @type {Server}
 */
module.exports = class Server {
    constructor() {
        this.db = require("../db");
        this.logger = require("../utils/logger")("webServer", this.db);

        this.app = express();

        this.sockets = {};
        this.availSockets = {};
        this.services = {};
        this.socket = null;

        // No Caching
        this.app.disable('etag');
        this.#setCors()

        // Make all static files public available
        this.app.use(express.static(`${__dirname}/../../dist/`));

        // Publish documentation
        if (fs.existsSync(`${__dirname}/../../docs/build`) && parseInt(process.env.PUBLISH_DOC) === 1) {
            this.app.use("/docs", express.static(`${__dirname}/../../docs/build/html/`));
        }
        if (fs.existsSync(`${__dirname}/../../docs/api`) && parseInt(process.env.PUBLISH_API) === 1) {
            this.app.use("/api", express.static(`${__dirname}/../../docs/api/`));
        }

        // Routes for config
        this.logger.debug("Initializing Routes for config...");
        require("./routes/config")(this);

        this.logger.info("Initializing Session management...");
        this.session = this.#initSessionManagement();
        this.app.use(this.session);

        this.logger.info("Initializing Passport...");
        this.app.use(bodyParser.urlencoded({extended: false}));
        this.app.use(bodyParser.json());
        this.app.use(passport.initialize());
        this.app.use(passport.session());

        // Set login management
        this.#loginManagement();

        // all further urls reference to frontend
        this.app.use("/*", express.static(`${__dirname}/../../dist/index.html`));

        this.httpServer = http.createServer(this.app);
        this.#initWebsocketServer();
        this.#addSockets();
        this.#addServices();
    }

    /**
     * Set the login management (routes and passport)
     */
    #loginManagement() {
        this.logger.debug("Initialize Routes for auth...");
        require('./routes/auth')(this);

        passport.use(new LocalStrategy(async function verify(username, password, cb) {

            const user = await this.db.models['user'].find(username);
            if (!user) {
                return cb(null, false, {message: 'Incorrect username or password.'});
            }

            crypto.pbkdf2(password, user.salt, 310000, 32, 'sha256', (err, hashedPassword) => {
                if (err) {
                    return cb(err);
                }

                if (!crypto.timingSafeEqual(Buffer.from(user.passwordHash, 'hex'), hashedPassword)) {
                    return cb(null, false, {message: 'Incorrect username or password.'});
                }

                // filter row object, because not everything is the right information for website
                return cb(null, relevantFields(user));
            });
        }));


        // required to work -- defines strategy for storing user information
        passport.serializeUser(function (user, done) {
            done(null, user);
        });

        // required to work -- defines strategy for loading user information
        passport.deserializeUser(function (user, done) {
            done(null, user);
        });
    }

    /**
     * Set Cors restrictions
     */
    #setCors() {
        this.logger.debug("Set CORS Restriction");
        this.app.use(cors({
            origin: [
                'http://localhost:3000',
                "http://localhost:8080",
                process.env.ADDITIONAL_CORS_ORIGINS ?
                    process.env.ADDITIONAL_CORS_ORIGINS.split(",") : []].flat(),
            credentials: true
        }));
    }

    /**
     * Initialize the session management
     */
    #initSessionManagement() {

        // Define Session Model Table
        this.db.sequelize.define("session", {
            sid: {
                type: Sequelize.STRING,
                primaryKey: true,
            },
            userId: Sequelize.STRING,
            expires: Sequelize.DATE,
            data: Sequelize.TEXT,
        });

        // Sync Session Table
        this.db.sequelize.sync();

        // Sequelize Session Store
        this.logger.info("Initializing Sequelize Session Store...");
        const dbStore = new SequelizeStore({
            db: this.db.sequelize,
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
                origin: [
                    'http://localhost:3000',
                    "http://localhost:8080",
                    process.env.ADDITIONAL_CORS_ORIGINS ?
                        process.env.ADDITIONAL_CORS_ORIGINS.split(",") : []].flat(),
                methods: ["GET", "POST"],
                credentials: true,
            },
            origins: [
                'http://localhost:3000',
                "http://localhost:8080",
                process.env.ADDITIONAL_CORS_ORIGINS ?
                    process.env.ADDITIONAL_CORS_ORIGINS.split(",") : []].flat(),
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
        this.io.use((socket, next) => {
            const session = socket.request.session;
            if (session && "passport" in session) {
                socket.request.session.touch();
                socket.request.session.save();
                next();
            } else {
                socket.request.session.destroy();
                socket.emit("logout"); //force logout on client side
                this.logger.warn("Session in websocket not available! Send logout...");
                socket.disconnect();
            }
        })

        this.io.on("connection", (socket) => {
            this.availSockets[socket.id] = {};
            this.logger.debug("Socket connect: " + socket.id);

            Object.entries(this.sockets).map(async ([socketName, socketClass]) => {
                this.availSockets[socket.id][socketName] = new socketClass(this, this.io, socket);

                await this.availSockets[socket.id][socketName].init();
            });

            socket.on("disconnect", (reason) => {
                this.logger.debug("Socket disconnected: " + reason);
                delete this.availSockets[socket.id];
            });
        });

    }

    /**
     * Find all sockets and add sockets to the server
     */
    #addSockets() {
        this.logger.info("Adding sockets: ");
        fs.readdir(path.resolve(__dirname, "./sockets"), (err, files) => {
            if (err) {
                this.logger.error("Error while reading sockets directory: " + err);
                return;
            }
            files.forEach(file => {
                if (file.endsWith(".js")) {
                    const newSocket = require(path.resolve(__dirname, "./sockets") + "/" + file);
                    if (newSocket.prototype instanceof require(path.resolve(__dirname, "./Socket.js"))) {
                        this.addSocket(newSocket);
                    }
                }
            });
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
        this.sockets[socketClass.name] = socketClass;
    }

    /**
     * Find and add all services and add to the server
     */
    #addServices() {
        this.logger.info("Adding services: ");
        fs.readdir(path.resolve(__dirname, "./services"), (err, files) => {
            if (err) {
                this.logger.error("Error while reading services directory: " + err);
                return;
            }
            files.forEach(file => {
                if (file.endsWith(".js")) {
                    const newService = require(path.resolve(__dirname, "./services") + "/" + file);
                    if (newService.prototype instanceof require(path.resolve(__dirname, "./Service.js"))) {
                        this.addService(newService);
                    }
                }
            });
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

    /**
     * Start the webserver
     * @param port
     */
    start(port) {
        this.logger.debug("Start Webserver...");
        this.http = this.httpServer.listen(port, () => {
            this.logger.info("Server started on port " + port);
        });
    }

    /**
     * Stop the webserver
     */
    stop() {
        Object.entries(this.services).forEach(([name, service]) => {
            service.close();
        });
        this.io.close();
        this.http.close();
    }

}