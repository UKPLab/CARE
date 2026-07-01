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
 * @author Akash Gundapuneni
 */
module.exports = class AIService extends Service {
    /**
     * @param {*} server CARE webserver instance wiring DB plus RPC registrations.
     */
    constructor(server) {
        super(server, {
            cmdTypes: [
                "chatCompletion",
                "abortChatCompletion",
                "getStatus",
                "testModel",
                "getValidModels",
                "getModelShareOptions",
                "getModelShareConfig",
                "getHookShareConfig",
                "shareModel",
                "shareHook",
                "getModelOverview",
                "getHookOverview",
                "getAiModelOwnerSummaries",
                "getAiHookOwnerSummaries",
                "getAiHookDisplaySummaries",
            ],
            resTypes: [],
        });
    }

    /**
     * Bridges declared `cmdTypes` into nested chat/share helpers mirroring liteLLMRPC capabilities.
     *
     * @param {*} client RPC client emitting commands.
     * @param {string} command Handler key enumerated in constructor `cmdTypes`.
     * @param {*} data Serialized payload echoed from frontend tooling.
     * @returns {Promise<*>}
     */
    async command(client, command, data) {
        const handlers = {
            chatCompletion: () => chat.chatCompletion(this, client, data),
            abortChatCompletion: () => chat.abortChatCompletion(this, data),
            getStatus: () => chat.getStatus(this),
            testModel: () => chat.testModel(this, client, data),
            getValidModels: () => chat.getValidModels(this, client, data),
            getModelShareOptions: () => share.getModelShareOptions(this, client),
            getModelShareConfig: () => share.getModelShareConfig(this, client, data),
            getHookShareConfig: () => share.getHookShareConfig(this, client, data),
            shareModel: () => share.shareModel(this, client, data),
            shareHook: () => share.shareHook(this, client, data),
            getModelOverview: () => share.getModelOverview(this, client, data),
            getHookOverview: () => share.getHookOverview(this, client, data),
            getAiModelOwnerSummaries: () => share.getAiModelOwnerSummaries(this, client),
            getAiHookOwnerSummaries: () => share.getAiHookOwnerSummaries(this, client),
            getAiHookDisplaySummaries: () => share.getAiHookDisplaySummaries(this, client),
        };
        if (handlers[command]) {
            return handlers[command]();
        }
        return super.command(client, command, data);
    }
};
