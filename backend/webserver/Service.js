/* Service.js - Defines as new Service class

This class is used to create a service object

Author: Dennis Zyska (zyska@ukp.informatik....)
Source: --
*/

module.exports = class Service {
    constructor(server) {
        this.logger = require("../utils/logger.js")("Service/" + this.constructor.name);

        this.server = server;
    }

    /**
     * This method is called when a client connects to the service
     * @param {client} client The client that connected
     * @param {object} data The data that was sent with the connection
     */
    connectClient(client, data) {
        this.logger.info("Client connected with data " + data);
    }

    /**
     * This method is called when a client disconnects from the service
     * @param {client} client The client that disconnected
     * @param {object} data The data that was sent with the disconnection
     */
    disconnectClient(client, data) {
        this.logger.info("Client disconnected with data " + data);
    }
}