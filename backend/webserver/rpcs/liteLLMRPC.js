const RPC = require("../RPC.js");

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
        this.logger.info("Sending chatCompletion request: model=" + data.model);

        const response = await this.emit("chatCompletion", data);
        if (!response['success']) {
            this.logger.error("chatCompletion error: " + response['message']);
            throw new Error(response['message']);
        }
        return response;
    }

    /**
     * @returns {Promise<Object>} Status including connectivity info
     */
    async getStatus() {
        const online = await this.isOnline();
        return {online};
    }
}
