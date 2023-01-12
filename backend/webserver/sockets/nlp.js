const Socket = require("../Socket.js");

/**
 * Handling NLP Environment through websockets
 *
 * @author Dennis Zyska
 * @type {NLPSocket}
 */
module.exports = class NLPSocket extends Socket {
    init() {
        // init() called after a socket connection has been established to a client
        // hence, always check if we need to start a connection to the nlp service
        this.server.services['NLPService'].connect(this);

        // on disconnect of the client, disconnect this specific link to the nlp service
        this.socket.on("disconnect", (reason) => {
            this.server.services['NLPService'].disconnect(this);
        });
    }
}
