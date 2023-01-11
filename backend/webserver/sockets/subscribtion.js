const Socket = require("../Socket.js");

/**
 * Handle logs through websocket
 *
 * @author Dennis Zyska
 * @type {LoggerSocket}
 */
module.exports = class SubscriptionSocket extends Socket {
    init() {
        this.socket.on("subscribe:document", (data) => {
            this.socket.join("doc:" + data.doc);
            this.logger.info("Subscribe document " + data.doc);
        });

        this.socket.on("unsubscribe:document", (data) => {
            this.socket.leave("doc:" + data.doc);
            this.logger.info("Unsubscribe document " + data.doc);
        });

    }
}