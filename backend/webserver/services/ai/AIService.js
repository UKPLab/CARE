"use strict";

const Service = require("../../Service.js");
const chat = require("./chat");
const hook = require("./hook");
const budget = require("./budget");

/**
 * AIService — AI / LLM RPC handlers.
 *
 * Implementation is split under `./ai/` (`helpers`, `runtime`, `chat`, `hook`).
 *
 * @extends Service
 * @author Akash Gundapuneni, Mohammed Rawhani
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
            getProviders: () => chat.getProviders(this),
            getValidModels: () => chat.getValidModels(this, client, data),
        };
        if (handlers[command]) {
            return handlers[command]();
        }
        return super.command(client, command, data);
    }

    /**
     * Executes one LiteLLM chat completion.
     *
     * @param {Object} client Authenticated service client.
     * @param {Object} data LiteLLM-compatible request data.
     * @param {Object} [logOptions] Internal logging options.
     * @returns {Promise<{choices: unknown[]}>}
     */
    async chatCompletion(client, data, logOptions = {}) {
        return chat.chatCompletion(this, client, data, logOptions);
    }

    /**
     * Aborts one in-flight LiteLLM request.
     *
     * @param {Object} data Abort payload.
     * @returns {Promise<{aborted: boolean, message?: string}>}
     */
    async abortChatCompletion(data) {
        return chat.abortChatCompletion(this, data);
    }

    /**
     * Marks one logged AI request as aborted.
     *
     * @param {number} logId AI log identifier.
     * @param {Object} [options] Sequelize update options.
     * @returns {Promise<{cancelled: boolean}>}
     */
    async cancelRequest(logId, options = {}) {
        return budget.cancelRequest(this, logId, options);
    }

    /**
     * Loads one enabled AI hook.
     *
     * @param {number} hookId AI hook identifier.
     * @returns {Promise<Object>}
     */
    async loadEnabledHook(hookId) {
        return hook.loadEnabledHook(this, hookId);
    }

    /**
     * Resolves model parameters for one AI hook.
     *
     * @param {number} hookId AI hook identifier.
     * @param {number|null} [aiModelId] Optional selected model identifier.
     * @returns {Promise<Object>}
     */
    async resolveHookModelParams(hookId, aiModelId = null) {
        return hook.resolveHookModelParams(this, hookId, aiModelId);
    }

    /**
     * Resolves one AI hook prompt from placeholder values.
     *
     * @param {number} hookId AI hook identifier.
     * @param {Object} values Placeholder values.
     * @returns {Promise<{hook: Object, promptText: string}>}
     */
    async resolveHookPrompt(hookId, values = {}) {
        return hook.resolveHookPrompt(this, hookId, values);
    }
};
