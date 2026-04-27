const RPC = require("../RPC.js");
const {randomUUID} = require("crypto");

const ACK_TIMEOUT_BUFFER_MS = 5000;

/**
 * LiteLLMRPC - Routes LLM requests through LiteLLM for external and local model access
 *
 * Pure passthrough: the caller supplies the model, messages, API key, and any
 * provider-specific parameters. Nothing is hardcoded here; the bridge forwards
 * everything to LiteLLM as-is.
 * 
 * @author Akash Gundapuneni
 * @class
 * @extends RPC
 */
module.exports = class LiteLLMRPC extends RPC {

    constructor(server) {
        const url = "ws://" + process.env.RPC_LITELLM_HOST + ":" + process.env.RPC_LITELLM_PORT;
        super(server, url);

        this.timeout = 120000;
    }

    /**
     * Send a chat completion request to LiteLLM.
     * All fields in `data` are forwarded to the Python bridge verbatim.
     * At minimum the caller must provide `model` and `messages`.
     *
     * @param {Object} data - Arbitrary params forwarded to litellm.completion()
     * @param {string} data.model - Model identifier (provider-specific, e.g. "gpt-4o", "ollama/llama3")
     * @param {Array<Object>} data.messages - OpenAI-format messages array
     * @returns {Promise<Object>} LiteLLM response with choices and usage
     * @throws {Error} If the RPC service call fails
     */
    async chatCompletion(data) {
        const {
            __requestId: requestId = randomUUID(),
            __timeoutMs: requestedTimeoutMs,
            ...params
        } = data || {};
        const timeoutOverride = Number(requestedTimeoutMs);
        const timeoutMs = Number.isFinite(timeoutOverride) && timeoutOverride > 0
            ? Math.min(timeoutOverride, this.timeout)
            : this.timeout;
        const ackTimeoutMs = timeoutMs + ACK_TIMEOUT_BUFFER_MS;

        this.logger.info("Sending chatCompletion request: model=" + params.model + " requestId=" + requestId);

        let response;
        try {
            response = await this.emit("chatCompletion", {
                requestId,
                timeoutMs,
                params,
            }, ackTimeoutMs);
        } catch (err) {
            await this.abortChatCompletion(requestId, "RPC acknowledgement timed out");
            throw err;
        }
        if (!response['success']) {
            this.logger.error("chatCompletion error: " + response['message']);
            throw new Error(response['message']);
        }
        return response;
    }

    /**
     * Ask the Python bridge to abort an in-flight chat completion.
     *
     * @param {string} requestId
     * @param {string} [reason]
     * @returns {Promise<Object>}
     */
    async abortChatCompletion(requestId, reason = "request aborted") {
        if (!requestId) {
            return {aborted: false, message: "Missing requestId"};
        }

        try {
            const response = await this.emit("abortChatCompletion", {requestId, reason}, 5000);
            if (!response['success']) {
                this.logger.error("abortChatCompletion error: " + response['message']);
                return {aborted: false, message: response['message']};
            }
            return response.data || {aborted: true};
        } catch (err) {
            this.logger.error("abortChatCompletion failed: " + err.message);
            return {aborted: false, message: err.message};
        }
    }
}
