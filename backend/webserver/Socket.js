/**
 * Defines as new Socket class
 *
 * This class is used to create a new socket connection to the server.
 *
 * @author Dennis Zyska
 * @type {Socket}
 */
module.exports = class Socket {

    /**
     * Creates a new socket connection to the server.
     *
     * @param server - The webserver instance
     * @param io - The socket.io instance
     * @param socket - The socket.io socket instance
     */
    constructor(server, io, socket) {
        this.logger = require("../utils/logger.js")("Socket/" + this.constructor.name);

        this.server = server;
        this.io = io;
        this.socket = socket;

        this.user_id = socket.request.session.passport.user.id;
        this.logger.defaultMeta = {user_id: this.user_id};

    }

    /**
     * Initializes the socket connection
     * Note: Please overwrite with your sockets!
     */
    init() {
    }

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

    checkDocumentAccess(document_id) {
        if ("DocumentSocket" in this.server.sockets) {
            return this.server.sockets["DocumentSocket"].checkDocumentAccess(document_id);
        } else {
            return true;
        }
    }

    sendToast(message, title, variant = "success") {
        this.socket.emit("toast", {
            message: message,
            title: title,
            variant: variant
        });
    }

    /**
     * Add username as creator_name of an database entry with column creator
     *
     * @param data
     */
    updateCreatorName(data) {
        if ("UserSocket" in this.server.sockets) {
            return this.server.sockets["UserSocket"].updateCreatorName(data);
        } else {
            return data;
        }
    }
}
