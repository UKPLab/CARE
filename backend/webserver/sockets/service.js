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
     * @param {Object} data - The input data
     * @param {string} data.service - The name of the service to connect
     * @param {Object} data.data - Additional data to pass to the service
     * @param {Object} options - not used
     * @return {Promise<void>}
     */
    async connectService(data, options) {
        if (this.server.services[data.service]) {
            await this.server.services[data.service].connectClient(this, data.data);
        }
    }

    /**
     * Disconnects a service from the client
     * @param {Object} data - The input data
     * @param {string} data.service - The name of the service to disconnect
     * @param {Object} data.data - Additional data to pass to the service
     * @param {Object} options - not used
     * @returns {Promise<void>}
     */
    async disconnectService(data, options) {
        if (this.server.services[data.service]) {
            await this.server.services[data.service].disconnectClient(this, data.data);
        }
    }

    /**
     * Request a service (with default command)
     * @param {Object} data - The input data
     * @param {string} data.service - The name of the service to disconnect
     * @param {Object} data.data - Additional data to pass to the service
     * @param {Object} options - not used
     * @returns {Promise<void>}
     */
    async requestService(data, options) {
        if (this.server.services[data.service]) {
            await this.server.services[data.service].request(this, data.data);
        }
    }

    /**
     * Request a service but with a specific command
     * @param {Object} data - The input data
     * @param {string} data.service - The name of the service to disconnect
     * @param {Object} data.data - Additional data to pass to the service
     * @param {Object} options - not used
     * @returns {Promise<void>}
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