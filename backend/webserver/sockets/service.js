const Socket = require("../Socket.js");

/**
 * Handling Services through websockets
 *
 * @author Dennis Zyska
 * @type {ServiceSocket}
 */
module.exports = class ServiceSocket extends Socket {
    async init() {

        // init() is called after a socket connection has been established to a client
        // hence, always check if we need to start a connection to the service
        if (await this.models['setting'].get("service.nlp.enabled") === "true") {
            await this.server.services['NLPService'].connectClient(this);
        }

        // on disconnect of the client, disconnect this specific link to the service
        this.socket.on("serviceConnect", async (data) => {
            if (this.server.services[data.service]) {
                await this.server.services[data.service].connectClient(this, data.data);
            }
        });

        // on disconnect of the client, disconnect this specific link to the service
        this.socket.on("serviceDisconnect", async (data) => {
            if (this.server.services[data.service]) {
                await this.server.services[data.service].disconnectClient(this, data.data);
            }
        });

        this.socket.on("serviceRequest", async (data) => {
            if (this.server.services[data.service]) {
                await this.server.services[data.service].request(this, data.data);
            }
        })

        this.socket.on("serviceCommand", async (data) => {
            if (this.server.services[data.service]) {
                await this.server.services[data.service].command(this, data.command, data.data);
            }
        })

    }
}
