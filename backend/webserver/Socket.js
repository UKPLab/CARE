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
        this.models = this.server.db.models;
        this.io = io;

        this.socket = socket;
        this.user_id = socket.request.session.passport.user.id;
        this.userId = this.user_id;
        this.logger.defaultMeta = {userId: this.userId};

    }

    /**
     * Get initialized socket class object by class name
     * @param name
     * @returns {*}
     */
    getSocket(name) {
        return this.server.availSockets[this.socket.id][name];
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

    checkUserAccess(userId) {
        if (this.isAdmin()) {
            return true;
        }
        if (this.userId !== userId) {
            this.logger.warn("User " + this.userId + " tried to access user " + userId);
            return false;
        }
        return true;
    }

    checkDocumentAccess(documentId) {
        if ("DocumentSocket" in this.server.sockets) {
            return this.getSocket("DocumentSocket").checkDocumentAccess(documentId);
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
            return this.getSocket("UserSocket").updateCreatorName(data);
        } else {
            return data;
        }
    }
}
