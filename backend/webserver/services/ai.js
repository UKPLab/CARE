const Service = require("../Service.js");

/**
 * AIService - handles AI / LLM requests from the frontend.
 *
 * The client emits a `serviceCommand` with an ack callback and gets the
 * response back on that same callback (no `serviceRefresh` push events).
 *
 * Supported commands:
 *   - chatCompletion(data): forward the payload to LiteLLM as-is
 *   - abortChatCompletion(data): abort an in-flight LiteLLM request by id
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
                "getStatus",
                "testModel"
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
            case "testModel":
                return await this.testModel(client, data);
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
     * Abort an in-flight chat completion request.
     *
     * @param {object} data
     * @param {string} data.requestId frontend-generated request id
     * @param {string} [data.reason] diagnostic reason for logs
     * @returns {Promise<object>}
     */
    async abortChatCompletion(data) {
        const rpc = this.#getRPC();
        if (!rpc || !(await rpc.isOnline())) {
            return {aborted: false, message: "LiteLLM service is not connected"};
        }

        return await rpc.abortChatCompletion(data && data.requestId, data && data.reason);
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

    /**
     * Test if a model is usable with the selected credential.
     *
     * @param {object} client
     * @param {object} data
     * @param {number} data.credentialId
     * @param {string} data.model
     * @param {object} [data.additionalParameters]
     * @returns {Promise<{ok:boolean, preview?:string}>}
     */
    async testModel(client, data) {
        const rpc = this.#getRPC();
        if (!rpc) {
            throw new Error("LiteLLM service is not available");
        }
        if (!(await rpc.isOnline())) {
            throw new Error("LiteLLM service is not connected");
        }

        const credentialId = Number(data?.credentialId);
        const model = typeof data?.model === "string" ? data.model.trim() : "";
        const provider = typeof data?.provider === "string" ? data.provider.trim() : "";
        if (!Number.isInteger(credentialId) || credentialId <= 0) {
            throw new Error("Missing or invalid credentialId");
        }
        if (!model) {
            throw new Error("Missing model");
        }

        let resolvedModel = model;
        if (provider) {
            const normalizedProvider = provider.toLowerCase().replace(/\s+inference$/, "").trim();
            const providerPrefix = `${normalizedProvider}/`;
            if (!resolvedModel.toLowerCase().startsWith(providerPrefix)) {
                resolvedModel = `${providerPrefix}${resolvedModel}`;
            }
        }
        if (!resolvedModel.includes("/")) {
            throw new Error("Provider is required when model name has no provider prefix");
        }

        const credential = await this.server.db.models["ai_credential"].getById(credentialId, {
            attributes: ["id", "userId", "apiKey", "apiBaseUrl", "apiVersion", "enabled", "deleted"],
        });
        if (!credential || credential.deleted) {
            throw new Error("Credential not found");
        }
        if (!client?.userId || credential.userId !== client.userId) {
            throw new Error("You are not allowed to access this credential");
        }
        if (!credential.enabled) {
            throw new Error("Credential is disabled");
        }

        const params = {
            model: resolvedModel,
            messages: [{role: "user", content: "ping"}],
            max_tokens: 16,
            api_key: credential.apiKey,
        };
        if (credential.apiBaseUrl) {
            params.api_base = credential.apiBaseUrl;
        }
        if (credential.apiVersion) {
            params.api_version = credential.apiVersion;
        }
        if (
            data?.additionalParameters &&
            typeof data.additionalParameters === "object" &&
            !Array.isArray(data.additionalParameters)
        ) {
            const reservedKeys = new Set([
                "model",
                "messages",
                "api_key",
                "api_base",
                "api_version",
                "max_tokens",
            ]);
            const safeAdditionalParameters = Object.fromEntries(
                Object.entries(data.additionalParameters)
                    .filter(([key]) => !reservedKeys.has(key))
            );
            Object.assign(params, safeAdditionalParameters);
        }

        const response = await rpc.chatCompletion(params);
        const payload = response?.data !== undefined ? response.data : response;
        const content = payload?.choices?.[0]?.message?.content;

        let outputText = "";
        if (typeof content === "string") {
            outputText = content;
        } else if (Array.isArray(content)) {
            outputText = content
                .map((part) => {
                    if (typeof part === "string") {
                        return part;
                    }
                    if (part && typeof part === "object" && typeof part.text === "string") {
                        return part.text;
                    }
                    return "";
                })
                .filter(Boolean)
                .join("\n");
        } else if (content !== undefined && content !== null) {
            outputText = String(content);
        }

        return {ok: true, outputText};
    }
};
