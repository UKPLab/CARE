/**
 * Recent diagnostic events for problem reports.
 *
 * Records only structured, bounded metadata: script and interface errors, failed
 * socket operations (event name, error key/code and correlation id, never the
 * request data), connection changes and page changes (path only). Console output
 * is not captured. The backend applies the configured limits and sanitizes
 * every entry again before a report is previewed or saved.
 *
 * @author Akash Gundapuneni
 */

// Matches the backend's fixed diagnosticsMaxEntries / diagnosticsMaxMessageLength caps;
// the configured (smaller) limits are applied by the backend.
const BUFFER_SIZE = 200;
const MESSAGE_MAX_LENGTH = 1000;

const entries = [];

/**
 * @param {*} value Any value
 * @returns {string|undefined} Bounded text, or undefined when empty
 */
function boundedText(value) {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    const text = String(value);
    return text.length > MESSAGE_MAX_LENGTH ? text.slice(0, MESSAGE_MAX_LENGTH) : text;
}

/**
 * @param {string} url Script URL
 * @returns {string|undefined} File name without origin, path or query
 */
function fileName(url) {
    if (!url) {
        return undefined;
    }
    return String(url).split(/[?#]/)[0].split("/").pop() || undefined;
}

/**
 * Add one diagnostic event to the in-memory buffer.
 *
 * @param {Object} entry Event with a type and optional metadata fields
 * @returns {void}
 */
export function recordDiagnostic(entry) {
    const cleaned = Object.fromEntries(
        Object.entries({...entry, time: new Date().toISOString()})
            .map(([key, value]) => [key, typeof value === "number" ? value : boundedText(value)])
            .filter(([, value]) => value !== undefined)
    );
    entries.push(cleaned);
    if (entries.length > BUFFER_SIZE) {
        entries.shift();
    }
}

/**
 * @returns {Object[]} Copy of the recorded events, oldest first
 */
export function getDiagnostics() {
    return entries.map((entry) => ({...entry}));
}

/**
 * Wrap socket emits so failed acknowledgements are recorded with their correlation id.
 *
 * @param {Object} socket socket.io-client socket
 * @returns {void}
 */
function trackSocket(socket) {
    const emit = socket.emit.bind(socket);
    socket.emit = (event, ...args) => {
        const callback = args[args.length - 1];
        if (typeof callback === "function") {
            args[args.length - 1] = (...response) => {
                // socket.timeout(...).emit() passes (error, response) instead of (response)
                const result = response[0] instanceof Error ? null : response[response.length - 1];
                if (response[0] instanceof Error) {
                    recordDiagnostic({type: "failedOperation", event, reason: "timeout"});
                } else if (result && result.success === false) {
                    recordDiagnostic({type: "failedOperation", event, key: result.key, code: result.code, errorId: result.errorId});
                }
                return callback(...response);
            };
        }
        return emit(event, ...args);
    };
    socket.on("disconnect", (reason) => recordDiagnostic({type: "connection", reason: `disconnect: ${reason}`}));
    socket.on("connect_error", () => recordDiagnostic({type: "connection", reason: "connect_error"}));
}

/**
 * Start collecting diagnostics for the whole app.
 *
 * @param {Object} app Vue application
 * @param {Object} socket socket.io-client socket used by the app
 * @param {Object} router Vue router
 * @returns {void}
 */
export function installDiagnostics(app, socket, router) {
    window.addEventListener("error", (event) => {
        recordDiagnostic({
            type: "error",
            source: fileName(event.filename),
            line: event.lineno,
            column: event.colno,
        });
    });
    window.addEventListener("unhandledrejection", () => {
        recordDiagnostic({type: "unhandledRejection"});
    });

    const previousHandler = app.config.errorHandler;
    app.config.errorHandler = (error, instance, info) => {
        recordDiagnostic({
            type: "vueError",
            info,
            component: instance && instance.$options ? instance.$options.name : undefined,
        });
        if (previousHandler) {
            previousHandler(error, instance, info);
        } else {
            // Vue only logs uncaught errors itself when no handler is set
            console.error(error);
        }
    };

    trackSocket(socket);
    router.afterEach((to) => recordDiagnostic({type: "navigation", path: to.path}));
}
