"use strict";

const Service = require("../Service.js");
const conversation = require("./aiAssistant/conversation.js");
const dialogue = require("./aiAssistant/dialogue.js");

/**
 * Manages AI assistant workflows.
 *
 * @extends Service
 * @author Mohammed Rawhani
 */
module.exports = class AIAssistantService extends Service {
    /**
     * @param {*} server CARE webserver instance.
     */
    constructor(server) {
        super(server, {
            cmdTypes: [
                "getConversation",
                "sendConversationMessage",
                "retryConversationMessage",
                "abortConversationMessage",
                "getDialogueConversation",
                "sendDialogueAnswer",
                "retryDialogueMessage",
                "abortDialogueMessage",
            ],
            resTypes: [],
        });
    }

    /**
     * Fails responses a previous server run left pending, so sessions can send again.
     */
    async init() {
        try {
            const count = await this.server.db.models["ai_message"].failPendingMessages();
            this.logger.info(`Failed ${count} AI responses left pending`);
        } catch (error) {
            this.logger.error("Failed to release pending AI responses: " + error.message);
        }
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
            getConversation: () => conversation.getConversation(this, client, data),
            sendConversationMessage: () => conversation.sendConversationMessage(this, client, data),
            retryConversationMessage: () => conversation.retryConversationMessage(this, client, data),
            abortConversationMessage: () => conversation.abortConversationMessage(this, client, data),
            getDialogueConversation: () => dialogue.getDialogueConversation(this, client, data),
            sendDialogueAnswer: () => dialogue.sendDialogueAnswer(this, client, data),
            retryDialogueMessage: () => dialogue.retryDialogueMessage(this, client, data),
            abortDialogueMessage: () => dialogue.abortDialogueMessage(this, client, data),
        };
        if (handlers[command]) {
            return handlers[command]();
        }
        return super.command(client, command, data);
    }
};
