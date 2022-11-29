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
            if (!this.server.service['NLPService'].connected)
                this.server.service['NLPService'].connect();
        });

        this.socket.on("disconnect", (reason) => {
            if (this.server.service['NLPService'].connected) {
                this.server.service['NLPService'].disconnect();
            }
        });
    }
}
