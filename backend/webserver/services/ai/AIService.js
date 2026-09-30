"use strict";

const Service = require("../../Service.js");
const chat = require("./chat");
const hook = require("./hook");
const request = require("./request");

/**
 * AIService — AI / LLM RPC handlers.
 *
 * Implementation is split across `./ai/` modules and shared backend AI helpers.
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
     * Fails requests a previous server run left in progress, so they no longer block sessions.
     */
    async init() {
        try {
            const count = await this.server.db.models["ai_log"].failInProgressLogs();
            this.logger.info(`Failed ${count} AI requests left in progress`);
        } catch (error) {
            this.logger.error("Failed to release in-progress AI requests: " + error.message);
        }
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

    /**
     * Runs an internal AI action for other backend services.
     *
     * @param {string} action Internal action name.
     * @param {Object} client Authenticated service client.
     * @param {Object} [data] Action payload.
     * @param {Object} [options] Internal action options.
     * @returns {Promise<*>}
     */
    async call(action, client, data = {}, options = {}) {
        const actions = {
            chatCompletion: () => chat.chatCompletion(this, client, data, options.log, {onDelta: options.onDelta}),
            abortChatCompletion: () => chat.abortChatCompletion(this, client, data),
            cancelRequest: () => request.cancelRequest(this, data?.logId, options.db),
            loadHook: () => hook.loadEnabledHook(this, data?.hookId),
            resolveHookModel: () => hook.resolveSelectedHookModel(this, data?.hookId, data?.aiModelId),
            resolveHookPrompt: () => hook.resolveHookPrompt(this, data?.hookId, data?.values),
        };
        if (!actions[action]) {
            throw new Error(`Unknown AI action: ${action}`);
        }
        return actions[action]();
    }
};
