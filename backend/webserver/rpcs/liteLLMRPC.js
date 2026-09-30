const RPC = require("../RPC.js");
const {randomUUID} = require("crypto");
const {normalizeAiHookOutputMode} = require("../../utils/aiHookOutputModes.js");

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
     * @param {number} data.outputMode - Optional. Internal CARE output mode. `1` repairs JSON content in the Python bridge.
     * @param {Object} [options] - Internal streaming options.
     * @param {function(string): void} [options.onDelta] - Receives temporary answer text.
     * @returns {Promise<Object>} LiteLLM response with choices and usage
     * @throws {Error} If the RPC service call fails
     */
    async chatCompletion(data, {onDelta} = {}) {
        const {
            __requestId: requestId,
            __timeoutMs: requestedTimeoutMs,
            ...params
        } = data || {};
        if (!requestId) {
            throw new Error("Missing __requestId for chatCompletion");
        }
        const timeoutOverride = Number(requestedTimeoutMs);
        const timeoutMs = Number.isFinite(timeoutOverride) && timeoutOverride > 0
            ? Math.min(timeoutOverride, this.timeout)
            : this.timeout;
        const ackTimeoutMs = timeoutMs + ACK_TIMEOUT_BUFFER_MS;
        if (params.outputMode !== undefined) {
            params.outputMode = normalizeAiHookOutputMode(params.outputMode);
        }
        params.stream = typeof onDelta === "function";
        delete params.stream_options;
        const streamId = params.stream ? randomUUID() : undefined;
        const payload = {requestId, streamId, timeoutMs, params};

        this.logger.info("Sending chatCompletion request: model=" + params.model + " requestId=" + requestId);

        let response;
        try {
            response = streamId
                ? await this.emitStreamingCompletion(payload, onDelta, ackTimeoutMs)
                : await this.emit("chatCompletion", payload, ackTimeoutMs);
        } catch (err) {
            await this.abortChatCompletion(requestId, "RPC acknowledgement timed out");
            throw err;
        }
        if (!response.success) {
            this.logger.error("chatCompletion error: " + response.message);
            throw new Error(response.message);
        }
        return response;
    }

    /**
     * Forwards text while awaiting completion and cleans up before returning or throwing.
     * @param {Object} payload - Completion request with its private streamId.
     * @param {function(string): void} onDelta - Receives temporary answer text.
     * @param {number} ackTimeoutMs - Timeout for the final acknowledgement.
     * @returns {Promise<Object>} Final RPC response.
     * @author Mohammed Rawhani
     */
    async emitStreamingCompletion(payload, onDelta, ackTimeoutMs) {
        const socket = this.socket;
        let rejectStream;
        const streamFailure = new Promise((resolve, reject) => { rejectStream = reject; });
        const handleDelta = (data) => {
            try {
                if (data?.streamId === payload.streamId && typeof data.text === "string" && data.text) onDelta(data.text);
            } catch (error) {
                rejectStream(error);
            }
        };
        const handleDisconnect = () => rejectStream(new Error("LiteLLM service disconnected"));
        try {
            socket.on("chatCompletionDelta", handleDelta);
            socket.on("disconnect", handleDisconnect);
            return await Promise.race([
                this.emit("chatCompletion", payload, ackTimeoutMs),
                streamFailure,
            ]);
        } finally {
            socket?.off("chatCompletionDelta", handleDelta);
            socket?.off("disconnect", handleDisconnect);
        }
    }

    /**
     * Fetch LiteLLM's supported provider slugs for credential selection.
     *
     * @returns {Promise<{providers: string[]}>}
     */
    async getProviders() {
        const response = await this.emit("getProviders", {}, this.timeout);
        if (!response.success) {
            this.logger.error("getProviders error: " + response.message);
            throw new Error(response.message);
        }
        return response.data || {providers: []};
    }

    /**
     * Fetch models available for the supplied credential.
     *
     * @param {Object} data
     * @param {string} data.provider - Optional provider slug
     * @param {string} data.apiKey
     * @param {string} data.apiBaseUrl - Optional
     * @param {string} data.apiVersion - Optional
     * @returns {Promise<Object>}
     */
    async getValidModels(data) {
        const response = await this.emit("getValidModels", data || {}, this.timeout);
        if (!response.success) {
            this.logger.error("getValidModels error: " + response.message);
            throw new Error(response.message);
        }
        return response.data || {models: []};
    }

    /**
     * Ask the Python bridge to abort an in-flight chat completion.
     *
     * @param {string} requestId
     * @param {string} reason - Optional abort reason
     * @returns {Promise<Object>}
     */
    async abortChatCompletion(requestId, reason = "request aborted") {
        if (!requestId) {
            return {aborted: false, message: "Missing requestId"};
        }

        try {
            const response = await this.emit("abortChatCompletion", {requestId, reason}, 5000);
            if (!response.success) {
                this.logger.error("abortChatCompletion error: " + response.message);
                return {aborted: false, message: response.message};
            }
            return response.data || {aborted: true};
        } catch (err) {
            this.logger.error("abortChatCompletion failed: " + err.message);
            return {aborted: false, message: err.message};
        }
    }
}
