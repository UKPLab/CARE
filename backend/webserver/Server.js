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
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const Socket = require(path.resolve(__dirname, "./Socket.js"));
const Service = require(path.resolve(__dirname, "./Service.js"));
const RPC = require(path.resolve(__dirname,"./RPC.js"));
const statsScheduler = require('../db/stats');
const nodemailer = require('nodemailer');
const { setupDevAdmin } = require('./utils/devAdmin');
const { initializeAuth } = require("./auth");
const { parseUserAgent } = require("../utils/generic");

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
        this.socket = null;
        this.cache = {};
        this.cache['userName'] = {};
        this.mailer = null;

        this.rpcs = {};
        this.sockets = {};
        this.availSockets = {};
        this.services = {};
        this.documentQueues = new Map();
        this.authProviderStatus = {
            local: { ready: false, reason: "not-initialized" },
            orcid: { ready: false, reason: "not-initialized" },
            ldap: { ready: false, reason: "not-initialized" },
            saml: { ready: false, reason: "not-initialized" },
        };

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

        this.app.use(express.json()); 
        this.app.use(express.urlencoded({ 
            extended: true, 
            limit: "10kb" 
        }));

        this.logger.debug("Initializing Session management...");
        this.session = this.#initSessionManagement();
        this.app.use(this.session);

        this.logger.debug("Initializing Passport...");
        this.app.use(bodyParser.urlencoded({extended: false}));
        this.app.use(bodyParser.json());
        initializeAuth(this).catch((error) => {
            this.logger.error("Failed to initialize login management: " + error);
        });
        this.app.use(passport.initialize());
        this.app.use(passport.session());

        // Routes for config
        this.logger.debug("Initializing Routes for config...");
        require('./routes/export')(this);
        require("./routes/config")(this);
        require('./routes/auth')(this);
        require("./routes/setup")(this);

        this.app.use((req, res, next) => {
            if (req.method !== "GET") {
                return next();
            }
            if (req.path.startsWith("/api") || req.path.startsWith("/auth") || req.path.startsWith("/docs")) {
                return next();
            }
            return res.sendFile(path.resolve(__dirname, "../../dist/index.html"));
        });

        this.httpServer = http.createServer(this.app);
        Promise.resolve(this.initMailServer()).then(() => {
            if (this.mailer) {
                this.logger.info("Mail server initialized");
            } else {
                this.logger.warn("Mail server not available!");
            }
        }).catch((err) => {
            this.logger.error("initMailServer failed: " + err);
        });
        Promise.resolve(setupDevAdmin(this)); // When DEV_SKIP_WIZARD=true only: creates first admin from env and marks wizard complete.
        this.#initWebsocketServer();
        this.#discoverComponents("./rpcs", RPC, this.addRPC.bind(this));
        this.#discoverComponents("./sockets", Socket, this.addSocket.bind(this));
        this.#discoverComponents("./services", Service, this.addService.bind(this));

        // Graceful shutdown: flush all stats buffers on kill signals
        const handleShutdown = async (signal) => {
            try {
                this.logger.info(`Received ${signal}. Flushing statistics and shutting down...`);
                await this.flushAllStats();
            } catch (e) {
                this.logger.warn("Error during stats flush on shutdown: " + e);
            } finally {
                try {
                    this.stop();
                } catch (e2) {
                    this.logger.warn("Error during server stop on shutdown: " + e2);
                }
                process.exit(0);
            }
        };
        process.on('SIGINT', handleShutdown);
        process.on('SIGTERM', handleShutdown);
    }

    /**
     * Initialize the mail server from current DB settings.
     * Clears any previous transport first so disabled mail or changed mode is reflected.
     * @returns {Promise<void>}
     */
    async initMailServer() {
        this.mailer = null;

        if (await this.db.models['setting'].get("system.mailService.enabled") === "true") {
            if (await this.db.models['setting'].get("system.mailService.sendMail.enabled") === "true") {
                this.logger.info("Using sendmail transport");
                this.mailer = nodemailer.createTransport({
                    sendmail: true,
                    newline: 'unix',
                    path: await this.db.models['setting'].get("system.mailService.sendMail.path"),
                });
            } else if (await this.db.models['setting'].get("system.mailService.smtp.enabled") === "true") {
                this.logger.info("Using SMTP transport");
                const testAccount = await nodemailer.createTestAccount(); //TODO: for testing remove when using actual mail server
                // Get SMTP configuration from database
                const smtpHost = await this.db.models['setting'].get("system.mailService.smtp.host");
                const smtpPort = await this.db.models['setting'].get("system.mailService.smtp.port");
                const smtpSecure = await this.db.models['setting'].get("system.mailService.smtp.secure") === "true";
                const authEnabled = await this.db.models['setting'].get("system.mailService.smtp.auth.enabled") === "true";
                
                let transportConfig = {
                    host: smtpHost,
                    port: smtpPort,
                    secure: smtpSecure
                };
                
                if (authEnabled) {
                    const authUser = await this.db.models['setting'].get("system.mailService.smtp.auth.user");
                    const authPass = await this.db.models['setting'].get("system.mailService.smtp.auth.pass");

                    if (authUser && authPass) {
                        transportConfig.auth = {
                            user: authUser,
                            pass: authPass
                        };
                    } else {
                        this.logger.warn("SMTP authentication enabled but credentials not configured");
                    }
                }
                
                this.mailer = nodemailer.createTransport(transportConfig);
            }

        }

    }

    /**
     * Send a mail
     * @param to email address
     * @param subject of the mail
     * @param body body of the mail (plain text or HTML depending on options.isHtml)
     * @param {Object} [options] options
     * @param {boolean} [options.isHtml] if true, body is sent as HTML (Content-Type text/html); otherwise as plain text
     * @returns {Promise<void>}
     */
    async sendMail(to, subject, body, options = {}) {
        if (!this.mailer) {
            this.logger.warn(`Email service not configured. Would send email to ${to} with subject: ${subject}`);
            return;
        }

        const mailOptions = {
            from: await this.db.models['setting'].get("system.mailService.senderAddress"),
            to: to,
            subject: subject
        };
        if (options.isHtml === true) {
            mailOptions.html = body;
        } else {
            mailOptions.text = body;
        }

        this.mailer.sendMail(mailOptions, (err, info) => {
            if (err) {
                this.logger.error(err);
            } else {
                this.logger.info("Message send: " + info.messageId);
                console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info)); //TODO: for testing remove when using actual mail server
            }
        });
    }

    /**
     * Returns true if provider strategy is initialized and ready.
     * @param {string} provider - local|orcid|ldap|saml
     * @returns {boolean}
     */
    isAuthProviderReady(provider) {
        return !!this.authProviderStatus?.[provider]?.ready;
    }

    /**
     * Get detailed provider status.
     * @param {string} provider
     * @returns {{ready:boolean,reason:string}|{ready:false,reason:string}}
     */
    getAuthProviderStatus(provider) {
        return this.authProviderStatus?.[provider] || { ready: false, reason: "unknown-provider" };
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
        this.logger.debug("Initializing Sequelize Session Store...");
        const dbStore = new SequelizeStore({
            db: this.db.sequelize,
            checkExpirationInterval: 15 * 60 * 1000, // The interval at which to cleanup expired sessions in milliseconds.
            expiration: 24 * 60 * 60 * 1000  // The maximum age (in milliseconds) of a valid session.
        });
        dbStore.sync();

        //Session management
        return session({
            secret: process.env.SESSION_SECRET,
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
            if (session && "passport" in session && !session.twoFactorPending) {
                socket.request.session.touch();
                socket.request.session.save();
                next();
            } else if (session && session.twoFactorPending) {
                socket.emit("logout"); // force client back to auth flow
                this.logger.warn("Websocket blocked: 2FA verification pending.");
                socket.disconnect();
            } else {
                if (socket.request.session) {
                    socket.request.session.destroy();
                }
                socket.emit("logout"); //force logout on client side
                this.logger.warn("Session in websocket not available! Send logout...");
                socket.disconnect();
            }
        })

        this.io.on("connection", async (socket) => {
            this.availSockets[socket.id] = {};
            socket.connectedAt = socket.handshake?.time;
            socket.browser = parseUserAgent(socket.handshake?.headers["user-agent"]);
            socket.openComponents = {
                editor: []  // Array to track open documents
            };
            socket.appDataSubscriptions = {
                tables: {},
                ids: {},
                merged: {}
            };
            socket.userId = "";
            this.logger.debug("Socket connect: " + socket.id);

          
            await Promise.all(
                Object.entries(this.sockets).map(async ([socketName, socketClass]) => {
                    this.availSockets[socket.id][socketName] = new socketClass(this, this.io, socket);
                    await this.availSockets[socket.id][socketName].init();
                })
            );

            // All per-socket handlers are now initialized and listening, so it's
            // safe for clients (including replay clients) to start emitting events.
            socket.emit("ready");
            // Notify clients (e.g. an open recording session picker) that the
            // set of online sessions changed, so they can refresh live.
            this.io.emit("sessionsChanged");

            // (Removed) Uncaptured-connection warning: with per-socket recordings
            // there is no single active batch a new connection is "outside" of,
            // so the warning no longer has a clear meaning. New connections are
            // simply not recorded unless explicitly selected.

            socket.on("disconnect", async (reason) => {
                try {
                    this.logger.debug("Socket disconnected: " + reason);

                    // Save open documents on disconnect
                    for (const documentId of socket.openComponents.editor) {
                        if (this.availSockets[socket.id]['DocumentSocket']) {
                            await this.availSockets[socket.id]['DocumentSocket'].saveDocument(documentId);
                        }
                    }
                    // Flush pending statistics before cleanup
                    try {
                        const statSock = this.availSockets[socket.id]['StatisticSocket'];
                        await statSock._flushStats();
                    } catch (e) {
                        this.logger.warn("Failed to flush stats on disconnect: " + e);
                    }

                    // Broadcast user monitor stats before cleanup, UserSocket is not available after the socket is disconnected
                    try {
                        const userSock = this.availSockets[socket.id]['UserSocket'];
                        if (userSock) await userSock.broadcastStats(socket.id);
                    } catch (e) {
                        this.logger.warn("Failed to broadcast user monitor stats on disconnect: " + e);
                    }

                    // If a recorded socket drops mid-recording, stop ONLY that
                    // socket's recording and flag it "disconnected". Other active
                    // recordings (including other admins' batches) keep running.
                    try {
                        const activeRecordings = this.activeRecordings || {};
                        const entry = activeRecordings[socket.id];
                        // A start-recording claim has no recordingId until its
                        // transaction commits; there's nothing to stop or flag
                        // yet, and the claim expires on its own.
                        if (entry && entry.recordingId) {
                            const ownerSocketId = entry.ownerSocketId;
                            const recorder = this.availSockets[socket.id]['RecorderSocket'];
                            if (recorder) {
                                const stoppedId = entry.recordingId;
                                await recorder.stopRecording(
                                    { socketId: socket.id, status: "disconnected" },
                                    { internal: true }
                                );

                                // The disconnect-triggered stop runs outside the normal
                                // socket transaction flow, so the automatic table broadcast
                                // doesn't fire. Push the updated recording row to subscribed
                                // clients manually so their tables reflect the new status.
                                try {
                                    const updatedRow = await this.db.models["recording"].getById(stoppedId);
                                    if (updatedRow) {
                                        await recorder.broadcastTable("recording", [updatedRow]);
                                    }
                                } catch (e) {
                                    this.logger.warn("Failed to broadcast disconnected recording: " + e);
                                }

                                const ownerSocket = this.io.sockets.sockets.get(ownerSocketId);
                                if (ownerSocket) {
                                    ownerSocket.emit("toast", {
                                        title: "Recording stopped",
                                        message: "A recorded participant disconnected — recording flagged as disconnected.",
                                        variant: "warning",
                                    });
                                }
                            }
                        }
                    } catch (e) {
                        this.logger.warn("Failed to flag disconnected recording: " + e);
                    }

                    delete this.availSockets[socket.id];

                    // Notify clients that the online-session set changed so an
                    // open recording session picker can refresh live.
                    this.io.emit("sessionsChanged");
                } catch (err) {
                    this.logger.error("Error on socket disconnect: " + err);
                }
            });
        });
    }

    /**
     * This method finds and adds a specific component to the server instance
     * @param classPath to the specific component folder inside the backend/webserver (e.g.  ./sockets)
     * @param classObj the required class object constant (e.g., const Socket = require(path.resolve(__dirname, "./Socket.js"));)
     * @param addFunc the defined function inside the server.js class (i.e., this - e.g. this.addSocket)
     * @param extension  filter the files with the given extension
     */
    #discoverComponents(classPath, classObj, addFunc, extension = ".js"){
        this.logger.debug("Discover components in " + classPath);
        const files = fs.readdirSync(path.resolve(__dirname, classPath));

        files.map(file => {
            if (file.endsWith(extension)) {
                const newComponent = require(path.resolve(__dirname, classPath) + "/" + file);
                if (newComponent.prototype instanceof classObj) {
                    addFunc(newComponent);
                }
            }
        });

    }

    /**
     *
     * Add new sockets route of class Socket
     *
     * @param socketClass - class of the socket
     */
    addSocket(socketClass) {
        this.logger.debug("Add socket " + socketClass.name + " to webserver...");
        this.sockets[socketClass.name] = socketClass;
    }

    /**
     * Add new RPC route to the server
     *
     * @param rpcClass - class of the RPC
     */
    addRPC(rpcClass) {
        this.logger.debug("Add RPC " + rpcClass.name + " to webserver...");

        this.rpcs[rpcClass.name] = new rpcClass(this);
        this.rpcs[rpcClass.name].init();
    }

    /**
     * Add external services to the server
     *
     * @param serviceClass - class of the Service
     */
    addService(serviceClass) {
        this.logger.debug("Add service " + serviceClass.name + " to webserver...");

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
        // Start DB stats scheduler
        try {
            statsScheduler.start(this.db.sequelize, this.logger);
            this._statsScheduler = statsScheduler;
        } catch (e) {
            this.logger.warn('Failed to start DB stats scheduler: ' + e.message);
        }
        // Recover any recordings interrupted by the previous server shutdown
        this.recoverInterruptedRecordings().catch((e) => {
            this.logger.warn("recoverInterruptedRecordings failed: " + e);
        });
        return this.http;
    }

    /**
     * Stop the webserver
     */
    stop() {
        Object.entries(this.services).forEach(([name, service]) => {
            service.close();
        });
        this.io.close();
        if (this.http) {
            this.http.close();
        }
        if (this._statsScheduler) {
            this._statsScheduler.stop(this.logger);
        }
    }

    /**
     * Flush statistics buffers for all connected sockets.
     * Ensures no pending stats are lost during shutdown.
     * @returns {Promise<void>}
     */
    async flushAllStats() {
        try {
            const sockets = this.availSockets || {};
            for (const [sid, sockMap] of Object.entries(sockets)) {
                try {
                    const statSock = sockMap && sockMap['StatisticSocket'];
                    await statSock._flushStats();
                } catch (e) {
                    this.logger.warn(`Failed to flush stats for socket ${sid}: ${e}`);
                }
            }
        } catch (e) {
            this.logger.error("flushAllStats encountered an error: " + e);
        }
    }
    /**
     * Mark any recordings still in "recording" status as "interrupted".
     * These are recordings whose server died mid-capture — the in-memory
     * activeRecordings map is gone but the DB rows were never closed out.
     * @returns {Promise<void>}
     */
    async recoverInterruptedRecordings() {
        try {
            const stale = await this.db.models["recording"].getAllByKey("status", "recording");
            for (const rec of stale) {
                await this.db.models["recording"].updateById(rec.id, {
                    status: "interrupted",
                    endTime: rec.endTime || new Date(),
                });
                this.logger.warn(
                    `Marked recording ${rec.id} as interrupted (server was not running cleanly when stopped)`
                );
            }
            if (stale.length > 0) {
                this.logger.info(`Recovered ${stale.length} interrupted recording(s) on startup`);
            }
        } catch (e) {
            this.logger.error("Failed to recover interrupted recordings: " + e);
        }
    }

}
