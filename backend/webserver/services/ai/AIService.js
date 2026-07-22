"use strict";

const Service = require("../../Service.js");
const chat = require("./chat");
const hook = require("./hook");

/**
 * AIService — AI / LLM RPC handlers.
 *
 * Implementation is split under `./ai/` (`helpers`, `runtime`, `chat`, `hook`).
 *
 * @extends Service
 * @author Akash Gundapuneni, Mohamed Rawhani
 */
module.exports = class AIService extends Service {
    /**
     * @param {*} server CARE webserver instance wiring DB plus RPC registrations.
     */
    constructor(server) {
        super(server, {
            cmdTypes: [
                "chatCompletion",
                "runHook",
                "abortChatCompletion",
                "getStatus",
                "testModel",
                "getValidModels",
            ],
            resTypes: [],
        });
    }

    /**
     * Bridges declared `cmdTypes` into nested chat/hook helpers mirroring liteLLMRPC capabilities.
     *
     * @param {*} client RPC client emitting commands.
     * @param {string} command Handler key enumerated in constructor `cmdTypes`.
     * @param {*} data Serialized payload echoed from frontend tooling.
     * @returns {Promise<*>}
     */
    async command(client, command, data) {
        const handlers = {
            chatCompletion: () => chat.chatCompletion(this, client, data),
            runHook: () => hook.runHook(this, client, data),
            abortChatCompletion: () => chat.abortChatCompletion(this, data),
            getStatus: () => chat.getStatus(this),
            testModel: () => chat.testModel(this, client, data),
            getValidModels: () => chat.getValidModels(this, client, data),
        };
        if (handlers[command]) {
            return handlers[command]();
        }
        return super.command(client, command, data);
    }
};
