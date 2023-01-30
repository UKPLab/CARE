/* Service.js - Defines as new Service class

This class is used to create a service object

Author: Dennis Zyska (zyska@ukp.informatik....)
Source: --
*/

module.exports = class Service {
    constructor(server) {
        this.logger = require("../utils/logger.js")("Service/" + this.constructor.name);

        this.server = server;
        this.clients = {}
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

    /**
     * This method should be overwritte if the service needs to close any ressources
     * when the app is closed
     */
    close() {

    }

    request(client, data) {
        this.logger.info("Client request with data " + data);
    }

    send(client, type, data) {
        client.socket.emit("serviceRefresh", {service: this.constructor.name, type: type, data:data});
    }

    sendAll(type, data) {
        this.server.io.emit("serviceRefresh", {service: this.constructor.name, type: type, data:data});
    }

    /**
     * Additional commands for services
     * @param client
     * @param command
     * @param data
     */
    command(client, command, data) {
        this.logger.info("Client command " + command + " with data " + data);
    }
}