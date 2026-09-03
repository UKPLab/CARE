const TranslatableError = require("../utils/TranslatableError");
/**
 * This class is used to create a RPC object
 *
 * RPC.js - Defines as new RPC class
 *
 * @author Internal Crowd Programming
 */
const {io: io_client} = require("socket.io-client");
module.exports = class RPC {
    constructor(server, url) {
        this.logger = require("../utils/logger")("RPC/" + this.constructor.name, server.db);

        this.server = server;
        this.url = url;
        this.socket = null;

        this.retryDelay = 10000; //default delay between connection attempts
        this.timeout = 10000; //default timeout for connection
    }

    /**
     * This method should be overwritten if the service needs to initialize any resources
     * when the app is started
     * Default behavior is to call the reset
     * method to disconnect the socket if it exists and connect to the rpc service socket
     *
     * Tip: Overwrite updateEvents method to handle events
     *
     */
    async init() {
        await this.reset();

        this.socket = io_client(this.url,
            {
                reconnection: true,
                timeout: this.timeout,
            }
        );
        this.updateEvents(this.socket);
        this.logger.info("Connect to RPC server at " + this.url);
        this.socket.connect();

        this.logger.info("RPC initialized");
    }

    /**
     * This method should be overwritten if the service needs to reset any resources
     * Default behavior is to disconnect the
     * socket if it exists
     */
    async reset() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    /**
     * This method should be overwritten if the service needs to handle events
     * when the app is started
     * Default behavior is to handle connection errors
     * and reconnection attempts
     */
    async updateEvents(socket) {
        const self = this;

        // Handle connection errors
        socket.on("connect_error", async () => {
            setTimeout(() => {
                if (socket) {
                    socket.connect();
                }
            }, self.retryDelay);

        });

        // Handle reconnection attempts
        socket.on("reconnection_attempt", () => {
            self.logger.error("RPC reconnection attempt...");
        });

        // establishing a connection
        socket.on("connect", function () {
            self.logger.info(`Connection to RPC server established: ${socket.connected}`);

        });

        // deal with broken connection
        socket.on("disconnect", function () {
            self.logger.error(`Connection to RPC server disrupted: ${!socket.connected}`);
        });

    }

    /**
     * This method returns whether the RPC is online. For more details on the status, call the getStatus method.
     *
     * @returns {Promise<boolean>} false if offline and true if online
     */
    async isOnline() {
        if (!this.socket) {
            return false;
        }
        return this.socket.connected;
    }

    /**
     * Overwrite the destroy method to disconnect from the RPC service
     */
    async close() {
        await this.reset();
    }

    /**
     * This method waits for the RPC service to be online
     *
     * @param interval ms between checks
     * @param timeout ms until timeout
     * @returns {Promise<Boolean>}
     */
    async wait(interval = 500, timeout = 5000) {
        const self = this;
        return new Promise((resolve, reject) => {
            const endTime = Date.now() + timeout;

            async function check() {
                if (await self.isOnline()) {
                    resolve(true);
                } else if (Date.now() > endTime) {
                    reject(false);
                } else {
                    setTimeout(check, interval);
                }
            }

            check();
        });
    }

    /**
     * Returns a combined status for this RPC:
     *   - `online`: whether the local socket is connected
     *   - `health`: the payload returned by the Python RPC's "healthy" handler
     *     (omitted if the RPC does not implement it)
     *   - `error`: the error message if the health probe failed for any other reason
     *
     * @returns {Promise<{online: boolean, health?: object, error?: string}>}
     */
    async getStatus() {
        const online = await this.isOnline();
        if (!online) {
            return {online: false};
        }
        try {
            const health = await this.healthy();
            return {online: true, health};
        } catch (err) {
            if (err.message === "Not Implemented") {
                return {online: true};
            }
            return {online: true, error: err.message};
        }
    }

    /**
     * Emits an event to the RPC service and returns the ack response.
     *
     * @param {string} event
     * @param {*} data
     * @param {number} [timeoutMs] override of the default `this.timeout` for this call
     * @returns {Promise<Object>}
     */
    async emit(event, data, timeoutMs = this.timeout) {
        this.logger.info("Emitting event to RPC service...");

        if (!this.socket) {
            throw new TranslatableError("errors.rpc.serviceNotConnected");
        }

        return new Promise((resolve, reject) => {
            this.socket.timeout(timeoutMs).emit(event, data, (err, response) => {
                if (err) {
                    this.logger.error(err);
                    reject(err);
                } else {
                    this.logger.info(response);
                    resolve(response);
                }
            });
        });
    }


    /**
     * Standard health check for an RPC. Emits a "healthy" event to the
     * Python RPC service and returns its response.
     *
     * By convention, Python RPCs that implement a health check respond with
     * either:
     *   {success: true, data: {...}}                  - service is healthy
     *   {success: false, message: "Not Implemented"}  - opt-out
     *
     * Throws Error("Not Implemented") when:
     *   - the Python RPC explicitly replied with that message
     *   - the ack times out (python-socketio silently drops events without a
     *     registered handler, so timeout is our best signal for a missing
     *     implementation on the other side)
     *
     * Other errors (e.g. transport failures) propagate as-is.
     *
     * @param {number} [timeoutMs=5000] ack timeout in ms
     * @returns {Promise<*>} the `data` returned by the Python RPC
     * @throws {Error}
     */
    async healthy(timeoutMs = 5000) {
        let response;
        try {
            response = await this.emit("healthy", {}, timeoutMs);
        } catch (err) {
            if (err && err.message && /timed out|timeout/i.test(err.message)) {
                throw new Error("Not Implemented");
            }
            throw err;
        }

        if (response && response.success === false) {
            if (response.message === "Not Implemented") {
                throw new Error("Not Implemented");
            }
            throw new Error(response.message || "Health check failed");
        }

        return response && response.data !== undefined ? response.data : response;
    }
}