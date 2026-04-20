const Service = require("../Service.js");

/**
 * AIService - handles AI / LLM requests from the frontend.
 *
 * The client emits a `serviceCommand` with an ack callback and gets the
 * response back on that same callback (no `serviceRefresh` push events).
 *
 * Supported commands:
 *   - chatCompletion(data): forward the payload to LiteLLM as-is
 *   - getStatus():          report whether LiteLLM is reachable
 *
 * @class
 * @author Akash Gundapuneni
 * @extends Service
 */
module.exports = class AIService extends Service {
    constructor(server) {
        super(server, {
            cmdTypes: [
                "chatCompletion",
                "getStatus"
            ],
            resTypes: []
        });
    }

    /**
     * Route a command to the matching handler.
     * Return values / thrown errors are forwarded to the client's ack callback
     * by Socket.createSocket as {success, data} or {success:false, message}.
     *
     * @param {object} client
     * @param {string} command
     * @param {object} data
     * @returns {Promise<*>}
     */
    async command(client, command, data) {
        switch (command) {
            case "chatCompletion":
                return await this.chatCompletion(data);
            case "getStatus":
                return await this.getStatus();
            default:
                return await super.command(client, command, data);
        }
    }

    /**
     * @returns {Object|null} The LiteLLMRPC instance, or null if not registered.
     */
    #getRPC() {
        return this.server.rpcs['LiteLLMRPC'] || null;
    }

    /**
     * Send a chat completion request to LiteLLM.
     * The payload (model, messages, api_key, ...) is forwarded as-is.
     *
     * @param {object} data
     * @param {string} data.model
     * @param {Array<Object>} data.messages
     * @returns {Promise<object>} LiteLLM response (choices, usage, ...)
     * @throws {Error} if LiteLLM is unavailable or the call fails
     */
    async chatCompletion(data) {
        const rpc = this.#getRPC();
        if (!rpc) {
            this.logger.error("LiteLLM RPC is not registered");
            throw new Error("LiteLLM service is not available");
        }
        if (!(await rpc.isOnline())) {
            this.logger.error("LiteLLM RPC is not connected");
            throw new Error("LiteLLM service is not connected");
        }

        const response = await rpc.chatCompletion(data);
        return response.data !== undefined ? response.data : response;
    }

    /**
     * Report LiteLLM connection status.
     * Never throws - returns an object so the UI can render state directly.
     *
     * @returns {Promise<{online: boolean, error?: string}>}
     */
    async getStatus() {
        const rpc = this.#getRPC();
        if (!rpc) {
            return {online: false, error: "LiteLLM RPC not registered"};
        }
        try {
            return await rpc.getStatus();
        } catch (err) {
            this.logger.error("Failed to get LLM status: " + err.message);
            return {online: false, error: err.message};
        }
    }
};
