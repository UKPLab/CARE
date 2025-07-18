const Socket = require("../Socket.js");

/**
 * Handling Services through websockets
 *
 * @author Dennis Zyska
 * @type {ServiceSocket}
 * @class ServiceSocket
 */
class ServiceSocket extends Socket {

    /**
     * Connects a service to the client
     * 
     * @socketEvent serviceConnect
     * @param {Object} data The input data
     * @param {string} data.service The name of the service to connect
     * @param {Object} data.data Additional data to pass to the service
     * @param {Object} options Additional configuration parameters (currently unused).
     * @return {Promise<void>} A promise that resolves (with no value) once the service connection attempt is complete.
     */
    async connectService(data, options) {
        if (this.server.services[data.service]) {
            await this.server.services[data.service].connectClient(this, data.data);
        }
    }

    /**
     * Disconnects a service from the client
     * This acts as a bridge, invoking the `disconnectClient` method on the requested service if it exists.
     * 
     * @socketEvent serviceDisconnect
     * @param {Object} data The input data
     * @param {string} data.service The name of the service to disconnect
     * @param {Object} data.data Additional data to pass to the service
     * @param {Object} options Additional configuration parameters (currently unused).
     * @returns {Promise<void>} A promise that resolves (with no value) once the service disconnection attempt is complete.
     */
    async disconnectService(data, options) {
        if (this.server.services[data.service]) {
            await this.server.services[data.service].disconnectClient(this, data.data);
        }
    }

    /**
     * Request a service (with default command)
     * 
     * @socketEvent serviceRequest
     * @param {Object} data The input data
     * @param {string} data.service The name of the service to disconnect
     * @param {Object} data.data Additional data to pass to the service
     * @param {Object} options Additional configuration parameters (currently unused).
     * @returns {Promise<void>} A promise that resolves (with no value) once the service request attempt is complete.
     */
    async requestService(data, options) {
        if (this.server.services[data.service]) {
            await this.server.services[data.service].request(this, data.data);
        }
    }

    /**
     * Request a service but with a specific command
     * 
     * @socketEvent serviceCommand
     * @param {Object} data The input data
     * @param {string} data.service The name of the service to disconnect
     * @param {Object} data.data Additional data to pass to the service
     * @param {Object} options Additional configuration parameters (currently unused).
     * @returns {Promise<void>} A promise that resolves (with no value) once the service command attempt is complete.
     */
    async serviceCommand(data, options) {
        if (this.server.services[data.service]) {
            await this.server.services[data.service].command(this, data.command, data.data);
        }
    }


    async init() {

        // init() is called after a socket connection has been established to a client
        // hence, always check if we need to start a connection to the service
        if (await this.models['setting'].get("service.nlp.enabled") === "true") {
            await this.server.services['NLPService'].connectClient(this);
        }

        this.createSocket("serviceConnect", this.connectService, {}, false);
        this.createSocket("serviceDisconnect", this.disconnectService, {}, false);
        this.createSocket("serviceRequest", this.requestService, {}, false);
        this.createSocket("serviceCommand", this.serviceCommand, {}, false);

    }
}

module.exports = ServiceSocket;