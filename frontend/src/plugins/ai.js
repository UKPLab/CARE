/**
 * AI plugin - exposes AI service helpers to every Vue component.
 *
 * Lets any component send AI requests to the backend services without
 * mounting a dedicated component. Each call emits `serviceCommand` with
 * an ack callback and returns a Promise that resolves with the response
 * or rejects with an Error.
 *
 * Usage:
 *   const reply = await this.$ai.chatCompletion({ model, messages });
 *   const chat = await this.$aiAssistant.getConversation({ studySessionId, studyStepId });
 *
 * @author Akash Gundapuneni, Mohammed Rawhani
 */

// LiteLLM server-side timeout is 120s. Keep a small buffer so the real
// server error reaches the caller before the client gives up.
const DEFAULT_TIMEOUT_MS = 130000;

const createRequestId = () => {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
        return globalThis.crypto.randomUUID();
    }
    return `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

/**
 * Emit a `serviceCommand` and wrap the ack callback in a Promise.
 *
 * @param {object} socket    vue-3-socket.io $socket
 * @param {string} service   Service name
 * @param {string} command   Service command name
 * @param {object} data      payload
 * @param {object} opts client-side options
 * @returns {Promise<*>}     resolves with response.data; rejects with Error
 */
const emitServiceCommand = (socket, service, command, data = {}, opts = {}) => {
    const timeoutMs = opts.timeout || DEFAULT_TIMEOUT_MS;
    const abortCommand = opts.abortCommand || null;
    const requestId = abortCommand ? (data?.requestId || createRequestId()) : null;
    const hasRequestIdField = Object.prototype.hasOwnProperty.call(data || {}, "requestId");
    const payload = abortCommand ? {
        ...data,
        ...(hasRequestIdField ? {requestId} : {}),
        __requestId: requestId,
        __timeoutMs: timeoutMs,
    } : data;

    return new Promise((resolve, reject) => {
        let settled = false;
        let timer = null;

        const sendAbort = (reason) => {
            if (!abortCommand) return;
            socket.emit("serviceCommand", {
                service,
                command: abortCommand,
                data: {requestId, reason},
            }, () => {});
        };

        const clearTimer = () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        };

        timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            clearTimer();
            sendAbort(`client timeout after ${timeoutMs}ms`);
            reject(new Error(`AI request timed out after ${timeoutMs}ms (command: ${command})`));
        }, timeoutMs);

        socket.emit("serviceCommand", {
            service,
            command,
            data: payload,
        }, (response) => {
            if (settled) return;
            settled = true;
            clearTimer();

            if (!response) {
                reject(new Error(`No response received from ${service}`));
                return;
            }
            if (response.success) {
                resolve(response.data);
            } else {
                reject(new Error(response.message || `${service} request failed`));
            }
        });
    });
};

/**
 * Emit one AIService command.
 *
 * @param {Object} socket - Vue socket instance.
 * @param {string} command - AIService command name.
 * @param {Object} data - Command payload.
 * @param {Object} opts - Client-side options.
 * @returns {Promise<*>} Service response data.
 */
const emitAiCommand = (socket, command, data = {}, opts = {}) => {
    return emitServiceCommand(socket, "AIService", command, data, opts);
};

/**
 * Emit one AIAssistantService command.
 *
 * @param {Object} socket - Vue socket instance.
 * @param {string} command - AIAssistantService command name.
 * @param {Object} data - Command payload.
 * @param {Object} opts - Client-side options.
 * @returns {Promise<*>} Service response data.
 */
const emitAssistantCommand = (socket, command, data = {}, opts = {}) => {
    return emitServiceCommand(socket, "AIAssistantService", command, data, opts);
};

export default {
    install: (app) => {
        app.mixin({
            computed: {
                // `this.$ai` binds the component's $socket to the AIService helpers.
                // Defined as a computed so $socket is resolved per component.
                $ai() {
                    const socket = this.$socket;
                    return {
                        /**
                         * Send a chat completion request.
                         * @param {object} params - at minimum `model` and `messages`
                         * @param {object} [opts]
                         * @param {number} [opts.timeout] - override client-side timeout (ms)
                         * @returns {Promise<object>}
                         */
                        chatCompletion(params, opts = {}) {
                            return emitAiCommand(
                                socket,
                                "chatCompletion",
                                params,
                                {...opts, abortCommand: "abortChatCompletion"},
                            );
                        },

                        /**
                         * Run an AI hook against a study step: the backend resolves the hook's prompt
                         * template from the step context and forwards it through the chat path.
                         * @param {object} params - { hookId, studyStepId, studySessionId }
                         * @param {object} [opts]
                         * @param {number} [opts.timeout] - override client-side timeout (ms)
                         * @returns {Promise<{choices: object[], outputText: string}>}
                         */
                        runHook(params, opts = {}) {
                            return emitAiCommand(socket, "runHook", params, opts);
                        },

                        /**
                         * Get current LiteLLM / AIService connection status.
                         * @returns {Promise<{online: boolean, error?: string}>}
                         */
                        getStatus() {
                            return emitAiCommand(socket, "getStatus", {}, {timeout: 10000});
                        },
                    };
                },
                // `this.$aiAssistant` binds the component's $socket to assistant workflow commands.
                $aiAssistant() {
                    const socket = this.$socket;
                    return {
                        /**
                         * Creates a client-side request identifier for abortable assistant calls.
                         * @returns {string}
                         */
                        createRequestId() {
                            return createRequestId();
                        },

                        /**
                         * Loads a study-session AI conversation snapshot.
                         * @param {object} params
                         * @returns {Promise<object>}
                         */
                        getConversation(params) {
                            return emitAssistantCommand(socket, "getConversation", params, {timeout: 10000});
                        },

                        /**
                         * Sends one user message and waits for the assistant response.
                         * @param {object} params
                         * @param {object} [opts]
                         * @returns {Promise<object>}
                         */
                        sendConversationMessage(params, opts = {}) {
                            return emitAssistantCommand(
                                socket,
                                "sendConversationMessage",
                                params,
                                {...opts, abortCommand: "abortConversationMessage"},
                            );
                        },

                        /**
                         * Retries one failed or aborted assistant response.
                         * @param {object} params
                         * @param {object} [opts]
                         * @returns {Promise<object>}
                         */
                        retryConversationMessage(params, opts = {}) {
                            return emitAssistantCommand(socket, "retryConversationMessage", params, opts);
                        },

                        /**
                         * Aborts one pending assistant response.
                         * @param {object} params
                         * @returns {Promise<object>}
                         */
                        abortConversationMessage(params) {
                            return emitAssistantCommand(socket, "abortConversationMessage", params, {timeout: 10000});
                        },
                    };
                },
            },
        });
    },
};
