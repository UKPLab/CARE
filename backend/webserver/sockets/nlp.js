const Socket = require("../Socket.js");

/**
 * Handling NLP Environment through websockets
 *
 * @author Dennis Zyska
 * @type {NLPSocket}
 */
module.exports = class NLPSocket extends Socket {
    init() {
        const self = this;
        const nlp = this.server.services['NLPService'];

        this.socket.on("connect", function () {
            if (!nlp.isConnected())
                nlp.connect();
        });

        // forwarding frontend messages to NLP server
        this.socket.onAny((msg, data) => {
            if (msg.startsWith("nlp_") && nlp.isConnected()) {
                nlp.request(msg.slice("nlp_".length).replace("_", "/"), data, this.socket.id);
            } else if (msg.startsWith("nlp_") && !nlp.isConnected()) {
                self.socket.emit("nlp_error", "Connection to NLP server disrupted.");
            }
        });

        this.socket.on("disconnect", (reason) => {
        });
    }
}
