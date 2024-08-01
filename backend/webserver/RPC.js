/**
 * This class is used to create a RPC object
 *
 * RPC.js - Defines as new RPC class
 *
 * @author Internal Crowd Programming
 */
module.exports = class RPC {
    constructor(server) {
        this.logger = require("../utils/logger")("RPC/" + this.constructor.name, server.db);

        this.server = server;
    }

    /**
     * This method should be overwritten if the service needs to initialize any resources
     * when the app is started
     */
    async init() {
        this.logger.info("RPC initialized");
    }

    /**
     * This method should be overwritten if the service needs to close any resources
     * when the app is closed
     */
    async close() {
        this.logger.info("RPC closed");
    }

    /**
     * This method calls the RPC
     * Note: Overwrite this method to handle requests
     * @param {object} data The data that was sent with the request
     */
    async call(data) {
        this.logger.info("RPC: " + data);
    }

    /**
     * This method returns whether the RPC is online. For more details on the status, call the getStatus method.
     *
     * @returns {Promise<boolean>} false if offline and true if online
     */
    async isOnline() {
        return false;
    }

    /**
     * This method returns the status of the RPC.
     *
     * @returns {Promise<{}>} an object describing the status
     */
    async getStatus() {
        return {};
    }
}