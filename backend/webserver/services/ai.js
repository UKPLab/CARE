const Service = require("../Service.js");

/**
 * AIService - handles AI / LLM requests from the frontend.
 *
 * The client emits a `serviceCommand` with an ack callback and gets the
 * response back on that same callback (no `serviceRefresh` push events).
 *
 * Supported commands:
 *   - chatCompletion(data): forward the payload to LiteLLM as-is
 *   - abortChatCompletion({requestId}): cancel a pending request
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
                "abortChatCompletion",
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
            case "abortChatCompletion":
                return await this.abortChatCompletion(data);
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
     * Forward a chat completion request to LiteLLM.
     * Payload (model, messages, api_key, ...) is passed through untouched.
     *
     * The full response is logged server-side; only `choices` is returned
     * to the frontend. Add more fields here if a client needs them.
     *
     * @param {object} data
     * @param {string} data.model
     * @param {Array<Object>} data.messages
     * @returns {Promise<{choices: Array<Object>}>}
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
        const payload = response.data !== undefined ? response.data : response;

        const {choices = [], usage, model, id} = payload || {};
        const finishReasons = choices.map(c => c.finish_reason).filter(Boolean);
        this.logger.info(
            `chatCompletion: id=${id} model=${model} ` +
            `tokens=${usage ? usage.total_tokens : "N/A"} ` +
            `finish=${finishReasons.join(",") || "N/A"}`
        );

        return {choices};
    }

    /**
     * Best-effort cancellation of a pending chat completion.
     * @param {object} data
     * @param {string} data.requestId
     * @returns {Promise<{aborted: boolean, requestId: string}>}
     */
    async abortChatCompletion(data = {}) {
        const {requestId} = data;
        if (!requestId) {
            throw new Error("Missing required field: requestId");
        }

        const rpc = this.#getRPC();
        if (!rpc) {
            this.logger.error("LiteLLM RPC is not registered");
            throw new Error("LiteLLM service is not available");
        }
        if (!(await rpc.isOnline())) {
            this.logger.error("LiteLLM RPC is not connected");
            throw new Error("LiteLLM service is not connected");
        }

        await rpc.abortChatCompletion({requestId});
        this.logger.info(`abortChatCompletion: requestId=${requestId}`);
        return {aborted: true, requestId};
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
