"use strict";

const Service = require("../../Service.js");
const chat = require("./chat");
const hook = require("./hook");

/**
 * AIService — AI / LLM RPC handlers.
 *
 * Implementation is split across `./ai/` modules and shared backend AI helpers.
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
                "getProviders",
                "getValidModels",
            ],
            resTypes: [],
        });
    }

    /**
     * Runs an AI hook for RPC clients and internal trigger jobs.
     *
     * @param {*} client Authenticated client context.
     * @param {*} data Hook execution payload.
     * @returns {Promise<*>}
     */
    async runHook(client, data) {
        return await hook.runHook(this, client, data);
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
            runHook: () => this.runHook(client, data),
            abortChatCompletion: () => chat.abortChatCompletion(this, client, data),
            getStatus: () => chat.getStatus(this),
            testModel: () => chat.testModel(this, client, data),
            getProviders: () => chat.getProviders(this),
            getValidModels: () => chat.getValidModels(this, client, data),
        };
        if (handlers[command]) {
            return handlers[command]();
        }
        return super.command(client, command, data);
    }
};
