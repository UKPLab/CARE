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
        this.timeout = 5000; //default timeout for connection
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

        // connect to test service
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
            self.logger.error("RPC Test Reconnection attempt...");
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
     * This method returns the status of the RPC.
     *
     * @returns {Promise<{}>} an object describing the status
     */
    async getStatus() {
        return {};
    }

    /**
     * This emits an event to the RPC service with handling the acknowledgement response accordingly
     *
     * @param event
     * @param data
     * @returns {Promise<Object>}
     */
    async emit(event, data) {
        this.logger.info("Emitting event to RPC service...");

        if (!this.socket) {
            throw new Error("RPC service not connected");
        }

        if (!this.socket) {
            throw new Error("RPC service not connected");
        }

        try {
            return new Promise((resolve, reject) => {
                this.socket.timeout(this.timeout).emit(event, data, (err, response) => {
                    if (err) {
                        this.logger.error(err);
                        reject(err);
                    } else {
                        this.logger.info(response);
                        resolve(response);
                    }
                });
            });

        } catch (err) {
            throw err;
        }
    }


    /**
     * This method should be overwritten to handle the call to the RPC service
     * @param data
     * @returns {Promise<*>}
     */
    async call(data) {
        this.logger.info("Calling RPC service...");

        try {
            return this.emit("call", data);
        } catch (err) {
            throw err
        }

    }
}