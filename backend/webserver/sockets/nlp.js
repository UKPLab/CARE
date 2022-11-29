const Socket = require("../Socket.js");

/**
 * Handling NLP Environment through websockets
 *
 * @author Dennis Zyska
 * @type {NLPSocket}
 */
module.exports = class NLPSocket extends Socket {

    init() {
        this.socket.on("connect", function () {
            if (!this.server.services['NLPService'].connected)
                this.server.services['NLPService'].connect();
        });

        this.socket.on("disconnect", (reason) => {
            if (this.server.services['NLPService'].connected) {
                this.server.services['NLPService'].disconnect();
            }
        });
    }
}
