/**
 * This class is used to create a service object
 *
 * @fileoverview Service.js - Defines as new Service class
 * @author Dennis Zyska
 */
module.exports = class Service {
    constructor(server) {
        this.logger = require("../utils/logger")("Service/" + this.constructor.name, this.server.db);

        this.server = server;
        this.clients = {}
    }

    /**
     * This method should be overwritten if the service needs to initialize any resources
     * when the app is started
     */
    async init();

     /**
     * This method should be overwritten if the service needs to close any resources
     * when the app is closed
     */
    async close();

    /**
     * This method is called when a client connects to the service
     * @param {client} client The client that connected
     * @param {object} data The data that was sent with the connection
     */
    async connectClient(client, data) {
        this.logger.info("Client connected with data " + data);
    }

    /**
     * This method is called when a client disconnects from the service
     * @param {client} client The client that disconnected
     * @param {object} data The data that was sent with the disconnection
     */
    async disconnectClient(client, data) {
        this.logger.info("Client disconnected with data " + data);
    }


    /**
     * This method is called when a client sends a request to the service
     * Note: Overwrite this method to handle requests
     * @param {client} client The client that sent the request (socket)
     * @param {object} data The data that was sent with the request
     */
    async request(client, data) {
        this.logger.info("Client request with data " + data);
    }

    /**
     * Use this method to send data to a client
     * @param {client} client The client to send the data to
     * @param {string} type The type of data that is being sent
     * @param {object} data The data to send
     */
    async send(client, type, data) {
        client.socket.emit("serviceRefresh", {service: this.constructor.name, type: type, data: data});
    }

    /**
     * Use this method to send data to all clients
     * @param {string} type The type of data that is being sent
     * @param {object} data The data to send
     */
    async sendAll(type, data) {
        this.server.io.emit("serviceRefresh", {service: this.constructor.name, type: type, data: data});
    }

    /**
     * Additional commands for services
     * Note: Overwrite this method to handle additional commands
     * @param {client} client The client that sent the command (socket)
     * @param {string} command The command that was sent
     * @param {object} data The data that was sent with the command
     */
    async command(client, command, data) {
        this.logger.info("Client command " + command + " with data " + data);
    }
}