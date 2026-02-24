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
const OrcidStrategy = require('passport-orcid').Strategy;
const LdapStrategy = require('passport-ldapauth');
const SamlStrategy = require('passport-saml').Strategy;
const {relevantFields} = require("../utils/auth");
const crypto = require("crypto");
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const Socket = require(path.resolve(__dirname, "./Socket.js"));
const Service = require(path.resolve(__dirname, "./Service.js"));
const RPC = require(path.resolve(__dirname,"./RPC.js"));
const statsScheduler = require('../db/stats');
const nodemailer = require('nodemailer');

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


        this.logger.debug("Initializing Session management...");
        this.session = this.#initSessionManagement();
        this.app.use(this.session);

        this.logger.debug("Initializing Passport...");
        this.app.use(bodyParser.urlencoded({extended: false}));
        this.app.use(bodyParser.json());
        this.#loginManagement().catch((error) => {
            this.logger.error("Failed to initialize login management: " + error);
        });
        this.app.use(passport.initialize());
        this.app.use(passport.session());

        // Routes for config
        this.logger.debug("Initializing Routes for config...");
        require("./routes/config")(this);
        require('./routes/auth')(this);

        // all further urls reference to frontend
        this.app.use("/*", express.static(`${__dirname}/../../dist/index.html`));

        this.httpServer = http.createServer(this.app);
        Promise.resolve(this.#initMailServer()).then(() => {
            if (this.mailer) {
                this.logger.info("Mail server initialized");
            } else {
                this.logger.warn("Mail server not available!");
            }
        });
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
     * Initialize the mail server
     * @returns {Promise<void>}
     */
    async #initMailServer() {

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
     * @param text of the mail
     * @returns {Promise<void>}
     */
    async sendMail(to, subject, text) {
        if (!this.mailer) {
            this.logger.warn(`Email service not configured. Would send email to ${to} with subject: ${subject}`);
            return;
        }
        
        this.mailer.sendMail({
            from: await this.db.models['setting'].get("system.mailService.senderAddress"),
            to: to,
            subject: subject,
            text: text
        }, (err, info) => {
            if (err) {
                this.logger.error(err);
            } else {
                this.logger.info("Message send: " + info.messageId);
                console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info)); //TODO: for testing remove when using actual mail server
            }
        });
    }

    /**
     * Set the login management (routes and passport)
     */
    async #loginManagement() {
        this.logger.debug("Initializing Auth Strategies...");

        // 1. Setup Passport Session Handling
        // TODO: Could optimize by storing the userId only
        // Storing the user object
        passport.serializeUser(function (user, done) {
            done(null, user);
        });

        // When the session is authenticated, deserializeUser is called 
        // to retrieve the full user object from DB
        passport.deserializeUser(function (user, done) {
            done(null, user);
        });

        // 2. Initialize Strategies
        await this.#setupLocalStrategy();
        await this.#setupOrcidStrategy();
        await this.#setupLdapStrategy();
        await this.#setupSamlStrategy();
    }

    /**
     * Local Strategy Logic
     */
    async #setupLocalStrategy() {
        passport.use('local-login', new LocalStrategy(async (username, password, cb) => {
            try {
                const user = await this.db.models['user'].find(username);
                if (!user) return cb(null, false, { message: 'Incorrect username or password.' });

                crypto.pbkdf2(password, user.salt, 310000, 32, 'sha256', (err, hashedPassword) => {
                    if (err) return cb(err);
                    if (!crypto.timingSafeEqual(Buffer.from(user.passwordHash, 'hex'), hashedPassword)) {
                        return cb(null, false, { message: 'Incorrect username or password.' });
                    }
                    // filter row object, because not everything is the right information for website
                    return cb(null, relevantFields(user));
                });
            } catch (e) { return cb(e); }
        }));
        this.authProviderStatus.local = { ready: true, reason: "ready" };
    }

    /**
     * ORCID Strategy Logic
     */
    async #setupOrcidStrategy() {
        const enabled = (await this.db.models['setting'].get("system.auth.loginMethods.orcid.enabled")) === "true";
        if (!enabled) {
            this.authProviderStatus.orcid = { ready: false, reason: "disabled" };
            return;
        }

        const clientID = await this.db.models['setting'].get("system.auth.orcid.clientId");
        const clientSecret = await this.db.models['setting'].get("system.auth.orcid.clientSecret");
        const callbackURL = await this.db.models['setting'].get("system.auth.orcid.callbackUrl");
        const sandbox = (await this.db.models['setting'].get("system.auth.orcid.sandbox")) === "true";
        
        const missing = [];
        if (!clientID) missing.push("system.auth.orcid.clientId");
        if (!clientSecret) missing.push("system.auth.orcid.clientSecret");
        if (!callbackURL) missing.push("system.auth.orcid.callbackUrl");
        if (missing.length > 0) {
            const reason = `missing-config:${missing.join(",")}`;
            this.authProviderStatus.orcid = { ready: false, reason };
            this.logger.warn(`[Auth] ORCID login enabled but not ready (${reason}).`);
            return;
        }

        const config = {
            sandbox,
            clientID,
            clientSecret,
            callbackURL,
            passReqToCallback: true
        };

        try {
            passport.use("orcid-login", new OrcidStrategy(config, async (req, accessToken, refreshToken, params, profile, done) => {
                try {
                    const orcidId = params.orcid;
                    let user = await this.db.models['user'].findOne({ where: { orcidId }, raw: true });

                    if (!user) {
                        const nameParts = (params.name || "").trim().split(/\s+/);
                        user = await this.db.models['user'].add({
                            orcidId,
                            firstName: nameParts[0] || null,
                            lastName: nameParts.length > 1 ? nameParts.slice(1).join(' ') : null,
                        }, {});
                        if (user && user.get) user = user.get({ plain: true });
                    }
                    return done(null, relevantFields(user));
                } catch (e) { return done(e); }
            }));
            this.authProviderStatus.orcid = { ready: true, reason: "ready" };
        } catch (e) {
            this.authProviderStatus.orcid = { ready: false, reason: `init-error:${e.message}` };
            this.logger.error(`[Auth] Failed to initialize ORCID strategy: ${e.message}`);
        }
    }

    /**
     * LDAP Strategy Logic
     */
    async #setupLdapStrategy() {
        const enabled = (await this.db.models['setting'].get("system.auth.loginMethods.ldap.enabled")) === "true";
        if (!enabled) {
            this.authProviderStatus.ldap = { ready: false, reason: "disabled" };
            return;
        }

        const url = await this.db.models['setting'].get("system.auth.ldap.url");
        const bindDN = await this.db.models['setting'].get("system.auth.ldap.bindDN");
        const bindCredentials = await this.db.models['setting'].get("system.auth.ldap.bindCredentials") || process.env.LDAP_BIND_CREDENTIALS;
        const searchBase = await this.db.models['setting'].get("system.auth.ldap.searchBase") || process.env.LDAP_SEARCH_BASE;
        const searchFilter = (await this.db.models['setting'].get("system.auth.ldap.searchFilter")) || process.env.LDAP_SEARCH_FILTER || "(uid={{username}})";

        const missing = [];
        if (!url) missing.push("system.auth.ldap.url");
        if (!bindDN) missing.push("system.auth.ldap.bindDN");
        if (!bindCredentials) missing.push("system.auth.ldap.bindCredentials");
        if (!searchBase) missing.push("system.auth.ldap.searchBase");
        if (missing.length > 0) {
            const reason = `missing-config:${missing.join(",")}`;
            this.authProviderStatus.ldap = { ready: false, reason };
            this.logger.warn(`[Auth] LDAP login enabled but not ready (${reason}).`);
            return;
        }

        const serverConfig = {
            url,
            bindDN,
            bindCredentials,
            searchBase,
            searchFilter
        };

        try {
            passport.use('ldap-login', new LdapStrategy({ server: serverConfig, passReqToCallback: true },
            async (req, ldapUser, done) => {
                try {
                    const username = Array.isArray(ldapUser?.uid) ? ldapUser.uid[0] : ldapUser?.uid;
                    const email = [].concat(ldapUser?.mail || ldapUser?.email || [])[0];

                    if (!username) return done(new Error('LDAP user missing UID'));

                    let user = await this.db.models['user'].findOne({ where: { ldapUsername: username }, raw: true });

                    if (!user && email) {
                        user = await this.db.models['user'].findOne({ where: { email }, raw: true });
                        if (user) {
                            await this.db.models['user'].update({ ldapUsername: username }, { where: { id: user.id } });
                            user.ldapUsername = username; // Update local reference
                        }
                    }

                    if (!user) {
                        user = await this.db.models['user'].add({
                            ldapUsername: username,
                            email,
                            firstName: [].concat(ldapUser?.givenName || ldapUser?.cn || 'New')[0],
                            lastName: [].concat(ldapUser?.sn || 'User')[0]
                        });
                        if (user && user.get) user = user.get({ plain: true });
                    }
                    return done(null, relevantFields(user));
                } catch (e) { return done(e); }
            }));
            this.authProviderStatus.ldap = { ready: true, reason: "ready" };
        } catch (e) {
            this.authProviderStatus.ldap = { ready: false, reason: `init-error:${e.message}` };
            this.logger.error(`[Auth] Failed to initialize LDAP strategy: ${e.message}`);
        }
    }

    /**
     * SAML Strategy Logic
     */
    async #setupSamlStrategy() {
        const enabled = (await this.db.models['setting'].get("system.auth.loginMethods.saml.enabled")) === "true";
        if (!enabled) {
            this.authProviderStatus.saml = { ready: false, reason: "disabled" };
            return;
        }

        const entryPoint = await this.db.models['setting'].get("system.auth.saml.entryPoint");
        const issuer = await this.db.models['setting'].get("system.auth.saml.issuer");
        const callbackUrl = await this.db.models['setting'].get("system.auth.saml.callbackUrl");
        const rawCert = (await this.db.models['setting'].get("system.auth.saml.cert"));
        const cert = typeof rawCert === "string" ? rawCert.replace(/\\n/g, "\n") : rawCert;

        const missing = [];
        if (!entryPoint) missing.push("system.auth.saml.entryPoint");
        if (!issuer) missing.push("system.auth.saml.issuer");
        if (!callbackUrl) missing.push("system.auth.saml.callbackUrl");
        if (!cert) missing.push("system.auth.saml.cert");
        if (missing.length > 0) {
            const reason = `missing-config:${missing.join(",")}`;
            this.authProviderStatus.saml = { ready: false, reason };
            this.logger.warn(`[Auth] SAML login enabled but not ready (${reason}).`);
            return;
        }

        const config = {
            entryPoint,
            issuer,
            callbackUrl,
            cert
        };

        try {
            passport.use('saml-login', new SamlStrategy(config, async (profile, done) => {
                try {
                    const nameId = profile?.nameID;
                    if (!nameId) return done(null, false, { message: "Missing SAML NameID." });

                    let user = await this.db.models['user'].findOne({ where: { samlNameId: nameId }, raw: true });

                    if (!user) {
                        const emailAttr = profile.email || profile.mail || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];
                        const email = Array.isArray(emailAttr) ? emailAttr[0] : emailAttr;

                        if (email) {
                            user = await this.db.models['user'].findOne({ where: { email }, raw: true });
                            if (user) {
                                await this.db.models['user'].update({ samlNameId: nameId }, { where: { id: user.id } });
                                user.samlNameId = nameId;
                            }
                        }
                    }

                    if (!user) return done(null, false, { message: "SAML account not linked." });
                    return done(null, relevantFields(user));
                } catch (e) { return done(e); }
            }));
            this.authProviderStatus.saml = { ready: true, reason: "ready" };
        } catch (e) {
            this.authProviderStatus.saml = { ready: false, reason: `init-error:${e.message}` };
            this.logger.error(`[Auth] Failed to initialize SAML strategy: ${e.message}`);
        }
    }

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

            Object.entries(this.sockets).map(async ([socketName, socketClass]) => {
                this.availSockets[socket.id][socketName] = new socketClass(this, this.io, socket);

                await this.availSockets[socket.id][socketName].init();
            });

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

                    
                    delete this.availSockets[socket.id];
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

}
