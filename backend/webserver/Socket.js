/* Socket.js - Defines as new Socket class

This class is used to create a new socket connection to the server.

Author: Dennis Zyska (zyska@ukp.informatik....)
Source: --
*/

module.exports = class Socket {
    constructor(io, socket) {
        this.io = io;
        this.socket = socket;
        this.logger = require("../utils/logger.js")("Socket/" + this.constructor.name);
        this.user_id = this.socket.request.session.passport.user.id;
        this.logger.defaultMeta = {user_id: this.user_id};

        this.init();
    }

    init();

    isAdmin() {
        return this.socket.request.session.passport.user.sysrole === "admin";
    }

    checkUserAccess(user_id) {
        if (this.isAdmin()) {
            return true;
        }
        if (this.user_id !== user_id) {
            this.logger.warn("User " + this.user_id + " tried to access user " + user_id);
            return false;
        }
        return true;
    }

    sendToast(message, title, variant = "success") {
        this.socket.emit("toast", {
            message: message,
            title: title,
            variant: variant
        });
    }
}
