const Socket = require("../Socket.js");
const {getSetting: dbGetSetting} = require("../../db/methods/settings");

/**
 * Handling Services through websockets
 *
 * @author Dennis Zyska
 * @type {ServiceSocket}
 */
module.exports = class ServiceSocket extends Socket {
    async init() {
        // init() called after a socket connection has been established to a client
        // hence, always check if we need to start a connection to the nlp service
        if (await dbGetSetting("service.nlp.enabled")) {
            this.server.services['NLPService'].connectClient(this);
        }

        // on disconnect of the client, disconnect this specific link to the nlp service
        this.socket.on("serviceConnect", (data) => {
            if (this.server.services[data.service]) {
                this.server.services[data.service].connectClient(this, data.data);
            }
        });

        // on disconnect of the client, disconnect this specific link to the nlp service
        this.socket.on("serviceDisconnect", (data) => {
            if (this.server.services[data.service]) {
                this.server.services[data.service].disconnectClient(this, data.data);
            }
        });

        this.socket.on("serviceRequest", (data) => {
            if (this.server.services[data.service]) {
                this.server.services[data.service].request(this, data.data);
            }
        })

        this.socket.on("serviceCommand", (data) => {
            if (this.server.services[data.service]) {
                this.server.services[data.service].command(this, data.command, data.data);
            }
        })



    }
}
