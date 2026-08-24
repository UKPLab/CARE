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
const { parseUserAgent } = require("../utils/helper/generic");
const { QUEUE_STATUS } = require("../utils/triggerQueueStatus.js");
const {
    buildEventContext,
    findMatchingTriggers,
    getTriggerWithCatalog,
} = require("../utils/helper/trigger/context.js");
const triggerQueue = require("../utils/helper/trigger/queue.js");
const triggerHandlers = require("../utils/helper/trigger/handlers/index.js");

const TRIGGER_POLL_INTERVAL_MS = 1000;
const DEFAULT_TRIGGER_TIMEOUT_SECONDS = 300;

/**
 * Coordinates trigger events and processes persisted trigger jobs.
 */
class TriggerManager {
    /**
     * @param {Object} server CARE server.
     */
    constructor(server) {
        this.server = server;
        this.started = false;
        this.processing = false;
        this.processingScheduled = false;
        this.processRequested = false;
        this.pollTimer = null;
        this.activeExecutions = new Map();
        this.executionControllers = new Map();
        this.unsettledHandlers = new Map();
    }

    /**
     * Starts polling for pending trigger jobs.
     *
     * @returns {void}
     */
    start() {
        if (this.started) {
            return;
        }
        this.started = true;
        this.pollTimer = setInterval(
            () => this.scheduleProcessing(),
            TRIGGER_POLL_INTERVAL_MS
        );
        this.pollTimer.unref?.();
        this.scheduleProcessing();
    }

    /**
     * Stops polling for trigger jobs.
     *
     * @returns {Promise<void>}
     */
    async close() {
        this.started = false;
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        await Promise.allSettled(this.activeExecutions.values());
    }

    /**
     * Creates pending jobs for every trigger matching an event.
     *
     * @param {string} eventName Trigger event name.
     * @param {Object} context Event payload.
     * @param {Object} options Runtime options.
     * @returns {Promise<Array<Object>>} Created queue items.
     */
    async addEvent(eventName, context = {}, options = {}) {
        const eventContext = await buildEventContext(
            this.server,
            eventName,
            context,
            options
        );
        const triggers = await findMatchingTriggers(
            this.server,
            eventName,
            eventContext,
            options
        );
        const queueItems = [];

        for (const trigger of triggers) {
            queueItems.push(await triggerQueue.createQueueItem(
                this.server,
                trigger,
                eventContext,
                options
            ));
        }

        this.notifyAfterCommit(queueItems, options, true);
        return queueItems;
    }

    /**
     * Requeues a failed or cancelled trigger job.
     *
     * @param {number} queueItemId Queue item id.
     * @param {Object} options Runtime options.
     * @returns {Promise<Object>}
     */
    async retryQueueItem(queueItemId, options = {}) {
        if (
            this.activeExecutions.has(Number(queueItemId))
            || this.unsettledHandlers.has(Number(queueItemId))
        ) {
            throw new Error("A running queue item cannot be retried.");
        }
        const queueItem = await triggerQueue.retryQueueItem(
            this.server,
            queueItemId,
            options
        );
        this.notifyAfterCommit([queueItem], options, true);
        return queueItem;
    }

    /**
     * Creates a new job from a completed trigger job.
     *
     * @param {number} queueItemId Queue item id.
     * @param {Object} options Runtime options.
     * @returns {Promise<Object>}
     */
    async rerunQueueItem(queueItemId, options = {}) {
        const queueItem = await triggerQueue.rerunQueueItem(
            this.server,
            queueItemId,
            options
        );
        this.notifyAfterCommit([queueItem], options, true);
        return queueItem;
    }

    /**
     * Cancels a pending or running trigger job.
     *
     * @param {number} queueItemId Queue item id.
     * @param {Object} options Runtime options.
     * @returns {Promise<Object>}
     */
    async cancelQueueItem(queueItemId, options = {}) {
        const queueItem = await triggerQueue.cancelQueueItem(
            this.server,
            queueItemId,
            options
        );
        const abortExecution = () => {
            this.executionControllers.get(Number(queueItemId))?.abort();
        };
        if (options.transaction && typeof options.transaction.afterCommit === "function") {
            options.transaction.afterCommit(abortExecution);
        } else {
            abortExecution();
        }
        this.notifyAfterCommit([queueItem], options, false);
        return queueItem;
    }

    /**
     * Schedules queue processing without overlapping worker loops.
     *
     * @returns {void}
     */
    scheduleProcessing() {
        if (!this.started) {
            return;
        }
        if (this.processing || this.processingScheduled) {
            this.processRequested = true;
            return;
        }

        this.processingScheduled = true;
        setImmediate(() => {
            this.processingScheduled = false;
            this.processPendingJobs().catch((error) => {
                this.server.logger.error(
                    `Trigger worker failed: ${error.message}`,
                    error
                );
            });
        });
    }

    /**
     * Claims and executes pending jobs while trigger capacity is available.
     *
     * @returns {Promise<void>}
     */
    async processPendingJobs() {
        if (this.processing || !this.started) {
            this.processRequested = true;
            return;
        }

        this.processing = true;
        this.processRequested = false;
        try {
            await this.recoverTimedOutQueueItems();
            const pendingItems = await triggerQueue.getPendingQueueItems(this.server);
            const triggerCache = new Map();

            for (const pendingItem of pendingItems) {
                let trigger = triggerCache.get(pendingItem.triggerId);
                if (trigger === undefined) {
                    trigger = await getTriggerWithCatalog(
                        this.server,
                        pendingItem.triggerId
                    );
                    triggerCache.set(pendingItem.triggerId, trigger || null);
                }

                const persistedConfig = pendingItem.configuration || {};
                const handlerName = persistedConfig.handler
                    || trigger?.action?.configuration?.handler
                    || null;
                const limit = Number(trigger?.parallelLimit ?? 1);
                const validLimit = Number.isFinite(limit) && limit >= 1;
                const claimedItem = await triggerQueue.claimQueueItem(
                    this.server,
                    pendingItem,
                    validLimit ? trigger : null,
                    handlerName
                );
                if (!claimedItem) {
                    continue;
                }
                await this.broadcastQueueItem(claimedItem);

                if (!trigger || !validLimit) {
                    const failedItem = await triggerQueue.finishQueueItem(
                        this.server,
                        claimedItem.id,
                        claimedItem.attemptCount,
                        {
                            status: QUEUE_STATUS.FAILED,
                            errorMessage: trigger
                                ? "Trigger parallel limit must be at least 1."
                                : "Associated trigger rule not found.",
                            completedAt: new Date(),
                        }
                    );
                    await this.broadcastQueueItem(failedItem);
                    continue;
                }

                this.launchExecution(trigger, claimedItem);
            }
        } finally {
            this.processing = false;
            if (this.processRequested) {
                this.processRequested = false;
                this.scheduleProcessing();
            }
        }
    }

    /**
     * Tracks one execution without blocking the queue polling loop.
     *
     * @param {Object} trigger Trigger with action catalog data.
     * @param {Object} queueItem Claimed queue item.
     * @returns {void}
     */
    launchExecution(trigger, queueItem) {
        const execution = this.runQueueItem(trigger, queueItem)
            .catch((error) => {
                this.server.logger.error(
                    `Trigger queue item ${queueItem.id} crashed: ${error.message}`,
                    error
                );
            })
            .finally(() => {
                this.activeExecutions.delete(Number(queueItem.id));
                this.scheduleProcessing();
            });
        this.activeExecutions.set(Number(queueItem.id), execution);
    }

    /**
     * Fails jobs whose worker disappeared or exceeded the configured timeout.
     *
     * @returns {Promise<void>}
     */
    async recoverTimedOutQueueItems() {
        const runningItems = await triggerQueue.getRunningQueueItems(this.server);
        const triggerCache = new Map();

        for (const queueItem of runningItems) {
            if (this.activeExecutions.has(Number(queueItem.id))) {
                continue;
            }
            let trigger = triggerCache.get(queueItem.triggerId);
            if (trigger === undefined) {
                trigger = await getTriggerWithCatalog(
                    this.server,
                    queueItem.triggerId
                );
                triggerCache.set(queueItem.triggerId, trigger || null);
            }

            const startedAt = new Date(queueItem.startedAt).getTime();
            if (
                Number.isFinite(startedAt)
                && Date.now() - startedAt < this.getTimeoutMilliseconds(trigger)
            ) {
                continue;
            }

            const failedItem = await triggerQueue.finishQueueItem(
                this.server,
                queueItem.id,
                queueItem.attemptCount,
                {
                    status: QUEUE_STATUS.FAILED,
                    errorMessage: "Trigger execution timed out.",
                    completedAt: new Date(),
                }
            );
            await this.broadcastQueueItem(failedItem);
        }
    }

    /**
     * Converts a trigger timeout in seconds to milliseconds.
     *
     * @param {Object|null} trigger Trigger row.
     * @returns {number}
     */
    getTimeoutMilliseconds(trigger) {
        const timeoutSeconds = Number(
            trigger?.timeout ?? DEFAULT_TRIGGER_TIMEOUT_SECONDS
        );
        const normalizedTimeout = Number.isFinite(timeoutSeconds) && timeoutSeconds > 0
            ? timeoutSeconds
            : DEFAULT_TRIGGER_TIMEOUT_SECONDS;
        return normalizedTimeout * 1000;
    }

    /**
     * Runs one claimed queue item and records its final status.
     *
     * @param {Object} trigger Trigger with action catalog data.
     * @param {Object} queueItem Claimed queue item.
     * @returns {Promise<*>}
     */
    async runQueueItem(trigger, queueItem) {
        const persistedConfig = queueItem.configuration || {};
        const triggerConfig = trigger.configuration || {};
        const persistedActionConfig = persistedConfig.action || {};
        const executionTrigger = {
            ...trigger,
            configuration: {
                ...triggerConfig,
                action: Object.keys(persistedActionConfig).length
                    ? persistedActionConfig
                    : triggerConfig.action || {},
            },
        };
        const handlerName = persistedConfig.handler
            || trigger.action?.configuration?.handler;
        const handler = triggerHandlers[handlerName];

        try {
            if (!handler) {
                throw new Error(
                    `No trigger handler registered for ${handlerName}`
                );
            }

            if (await triggerQueue.isQueueItemCancelled(this.server, queueItem.id)) {
                return { cancelled: true };
            }

            const abortController = new AbortController();
            this.executionControllers.set(Number(queueItem.id), abortController);
            let timeoutId;
            const timeout = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    abortController.abort();
                    reject(new Error("Trigger execution timed out."));
                }, this.getTimeoutMilliseconds(trigger));
                timeoutId.unref?.();
            });
            let result;
            try {
                const handlerPromise = Promise.resolve().then(() => handler(
                    this.server,
                    executionTrigger,
                    persistedConfig.event || {},
                    {
                        queueItemId: queueItem.id,
                        signal: abortController.signal,
                    }
                ));
                this.unsettledHandlers.set(Number(queueItem.id), handlerPromise);
                handlerPromise.then(
                    () => this.unsettledHandlers.delete(Number(queueItem.id)),
                    () => this.unsettledHandlers.delete(Number(queueItem.id))
                );
                result = await Promise.race([
                    handlerPromise,
                    timeout,
                ]);
            } finally {
                clearTimeout(timeoutId);
                this.executionControllers.delete(Number(queueItem.id));
            }

            if (await triggerQueue.isQueueItemCancelled(this.server, queueItem.id)) {
                await this.broadcastQueueItem(
                    await triggerQueue.getQueueItem(this.server, queueItem.id)
                );
                return { cancelled: true };
            }

            const completedItem = await triggerQueue.finishQueueItem(
                this.server,
                queueItem.id,
                queueItem.attemptCount,
                {
                    status: QUEUE_STATUS.COMPLETED,
                    completedAt: new Date(),
                }
            );
            await this.broadcastQueueItem(completedItem);
            return result;
        } catch (error) {
            if (await triggerQueue.isQueueItemCancelled(this.server, queueItem.id)) {
                await this.broadcastQueueItem(
                    await triggerQueue.getQueueItem(this.server, queueItem.id)
                );
                return { cancelled: true };
            }

            const failedItem = await triggerQueue.finishQueueItem(
                this.server,
                queueItem.id,
                queueItem.attemptCount,
                {
                    status: QUEUE_STATUS.FAILED,
                    errorMessage: error.message || String(error),
                    completedAt: new Date(),
                }
            );
            await this.broadcastQueueItem(failedItem);
            this.server.logger.error(
                `Trigger queue item ${queueItem.id} failed: ${error.message}`,
                error
            );
            return null;
        }
    }

    /**
     * Broadcasts committed queue changes and optionally starts the worker.
     *
     * @param {Array<Object>} queueItems Queue items to broadcast.
     * @param {Object} options Runtime options.
     * @param {boolean} shouldProcess Whether the worker should run afterward.
     * @returns {void}
     */
    notifyAfterCommit(queueItems, options, shouldProcess) {
        const notify = () => {
            setImmediate(async () => {
                try {
                    for (const queueItem of queueItems) {
                        await this.broadcastQueueItem(queueItem);
                    }
                } catch (error) {
                    this.server.logger.error(
                        `Failed to publish trigger queue changes: ${error.message}`,
                        error
                    );
                } finally {
                    if (shouldProcess) {
                        this.scheduleProcessing();
                    }
                }
            });
        };

        if (options.transaction && typeof options.transaction.afterCommit === "function") {
            options.transaction.afterCommit(notify);
        } else {
            notify();
        }
    }

    /**
     * Uses one connected socket to send an access-filtered table broadcast.
     *
     * @param {Object} queueItem Queue item.
     * @returns {Promise<void>}
     */
    async broadcastQueueItem(queueItem) {
        if (!queueItem) {
            return;
        }
        const triggerSockets = [];
        for (const socketMap of Object.values(this.server.availSockets)) {
            const triggerSocket = socketMap.TriggerSocket;
            if (!triggerSocket?.broadcastTable) {
                continue;
            }
            if (Number(triggerSocket.userId) === Number(queueItem.userId)) {
                await triggerSocket.broadcastTable("trigger_queue", [queueItem]);
                return;
            }
            triggerSockets.push(triggerSocket);
        }

        for (const triggerSocket of triggerSockets) {
            if (await triggerSocket.isAdmin()) {
                await triggerSocket.broadcastTable("trigger_queue", [queueItem]);
                return;
            }
        }
    }
}

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
        this.triggers = new TriggerManager(this);
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
                    await this.stop();
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

          
            Object.entries(this.sockets).map(async ([socketName, socketClass]) => {
                this.availSockets[socket.id][socketName] = new socketClass(this, this.io, socket);

                await this.availSockets[socket.id][socketName].init();
            })

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
        this.triggers.start();
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
     * @returns {Promise<void>}
     */
    async stop() {
        await this.triggers.close();
        await Promise.allSettled(
            Object.values(this.services).map((service) => service.close())
        );
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
