"use strict";

const Service = require("../Service.js");
const conversation = require("./ai/conversation.js");

/**
 * Manages persistent AI conversations.
 *
 * @extends Service
 * @author Mohammed Rawhani
 */
module.exports = class AIConversationService extends Service {
    /**
     * @param {*} server CARE webserver instance.
     */
    constructor(server) {
        super(server, {
            cmdTypes: [
                "getChat",
                "sendMessage",
                "retryMessage",
                "abortMessage",
            ],
            resTypes: [],
        });
    }

    /**
     * Routes conversation commands.
     *
     * @param {Object} client Service socket client.
     * @param {string} command Command name.
     * @param {Object} data Command payload.
     * @returns {Promise<*>} Command result.
     */
    async command(client, command, data) {
        const handlers = {
            getChat: () => conversation.getChat(this, client, data),
            sendMessage: () => conversation.sendMessage(this, client, data),
            retryMessage: () => conversation.retryMessage(this, client, data),
            abortMessage: () => conversation.abortMessage(this, client, data),
        };
        if (handlers[command]) {
            return handlers[command]();
        }
        return super.command(client, command, data);
    }
};
