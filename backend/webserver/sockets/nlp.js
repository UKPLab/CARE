/* Handling NLP Environment through websockets

Author: Dennis Zyska (zyska@ukp.informatik...)
Source: --
*/

const Socket = require("../Socket.js");

module.exports = class NLPSocket extends Socket {
    constructor(io, socket, nlp) {
        super(io, socket);
        this.nlp = nlp;
    }

    init() {
        this.socket.on("connect", function () {
            if (!this.nlp.connected)
                this.nlp.connect();
        });

        this.socket.on("disconnect", (reason) => {
            if (this.nlp.connected) {
                this.nlp.disconnect();
            }
        });
    }
}
