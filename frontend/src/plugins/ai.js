/**
 * AI plugin - exposes `this.$ai` to every Vue component.
 *
 * Lets any component send AI requests to the backend AIService without
 * mounting a dedicated component. Each call emits `serviceCommand` with
 * an ack callback and returns a Promise that resolves with the response
 * or rejects with an Error.
 *
 * Usage:
 *   const reply  = await this.$ai.chatCompletion({ model, messages });
 *   const status = await this.$ai.getStatus();
 *
 * @author Akash Gundapuneni
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
 * @param {string} command   AIService command name
 * @param {object} data      payload
 * @param {object} opts client-side options
 * @returns {Promise<*>}     resolves with response.data; rejects with Error
 */
const emitAiCommand = (socket, command, data = {}, opts = {}) => {
    const timeoutMs = opts.timeout || DEFAULT_TIMEOUT_MS;
    const isAbortable = command === "chatCompletion";
    const requestId = isAbortable ? createRequestId() : null;
    const payload = isAbortable ? {
        ...data,
        __requestId: requestId,
        __timeoutMs: timeoutMs,
    } : data;

    return new Promise((resolve, reject) => {
        let settled = false;
        let timer = null;

        const sendAbort = (reason) => {
            if (!isAbortable) return;
            socket.emit("serviceCommand", {
                service: "AIService",
                command: "abortChatCompletion",
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
            service: "AIService",
            command,
            data: payload,
        }, (response) => {
            if (settled) return;
            settled = true;
            clearTimer();

            if (!response) {
                reject(new Error("No response received from AIService"));
                return;
            }
            if (response.success) {
                resolve(response.data);
            } else {
                reject(new Error(response.message || "AIService request failed"));
            }
        });
    });
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
                            return emitAiCommand(socket, "chatCompletion", params, opts);
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
            },
        });
    },
};
