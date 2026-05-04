"use strict";

const Service = require("../../Service.js");
const chat = require("./chat");
const share = require("./share");

/**
 * AIService — AI / LLM and model-sharing RPC handlers.
 *
 * Implementation is split under `./ai/` (`helpers`, `runtime`, `chat`, `share`).
 *
 * @extends Service
 */
module.exports = class AIService extends Service {
    constructor(server) {
        super(server, {
            cmdTypes: [
                "chatCompletion",
                "abortChatCompletion",
                "getStatus",
                "testModel",
                "getModelShareOptions",
                "getModelShareConfig",
                "shareModel",
                "getModelOverview",
            ],
            resTypes: [],
        });
    }

    async command(client, command, data) {
        const handlers = {
            chatCompletion: () => chat.chatCompletion(this, client, data),
            abortChatCompletion: () => chat.abortChatCompletion(this, data),
            getStatus: () => chat.getStatus(this),
            testModel: () => chat.testModel(this, client, data),
            getModelShareOptions: () => share.getModelShareOptions(this, client),
            getModelShareConfig: () => share.getModelShareConfig(this, client, data),
            shareModel: () => share.shareModel(this, client, data),
            getModelOverview: () => share.getModelOverview(this, client, data),
        };
        if (handlers[command]) {
            return handlers[command]();
        }
        return super.command(client, command, data);
    }
};
