/**
 * Validation and sanitization for problem reports (see ProblemReportSocket).
 *
 * The server is the single source of truth for what gets stored: the frontend
 * preview calls normalizeReport() through the problemReportPreview socket, so
 * the preview shows exactly what problemReportSubmit later saves.
 *
 * @author Akash Gundapuneni
 */
const TranslatableError = require("../TranslatableError");

/**
 * Configurable values come from the "problemReport.*" settings (see loadReportSettings).
 * The caps below are fixed safety bounds that settings cannot raise.
 */
const HARD_LIMITS = {
    descriptionMaxLength: 20000,
    // Socket.IO accepts at most 100 MB per message (maxHttpBufferSize in Server.js)
    attachmentsMaxTotalBytes: 90 * 1024 * 1024,
    attachmentsMaxCount: 20,
    diagnosticsMaxEntries: 200,
    diagnosticsMaxMessageLength: 1000,
    diagnosticsMaxAgeMinutes: 24 * 60,
    choices: 12,
};

const DEFAULT_SETTINGS = {
    enabled: true,
    problemTypes: ["error", "wrongOrMissing", "slowOrStuck", "otherOrSuggestion"],
    askBlocked: true,
    frequencies: ["firstTime", "sometimes", "everyTime", "notSure"],
    descriptionMaxLength: 5000,
    reportsPerHour: 10,
    attachmentTypes: ["image/png", "image/jpeg", "image/gif", "image/webp", "video/mp4", "video/webm", "video/quicktime"],
    attachmentsMaxCount: 5,
    attachmentsMaxFileBytes: 20 * 1024 * 1024,
    attachmentsMaxTotalBytes: 50 * 1024 * 1024,
    diagnosticsMaxEntries: 50,
    diagnosticsMaxAgeMinutes: 30,
    diagnosticsMaxMessageLength: 300,
};

const ATTACHMENT_NAME_MAX_LENGTH = 120;
// Choice values are stable ids (translated in the UI) or short admin-configured labels
const CHOICE_PATTERN = /^[\p{L}\p{N} _-]{1,40}$/u;
const DIAGNOSTIC_TYPES = ["error", "unhandledRejection", "vueError", "failedOperation", "connection", "navigation"];

// Allow-list of diagnostic fields: anything else the client sends is dropped
const DIAGNOSTIC_TEXT_FIELDS = {info: 80, component: 80, reason: 80, source: 120};
const DIAGNOSTIC_ID_FIELDS = {
    event: {max: 80, pattern: /^[A-Za-z0-9_.:-]+$/},
    code: {max: 60, pattern: /^[A-Za-z0-9_.:-]+$/},
    key: {max: 120, pattern: /^[A-Za-z0-9_.-]+$/},
    errorId: {max: 36, pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i},
};
const DIAGNOSTIC_INT_FIELDS = ["line", "column"];

const CONTEXT_TEXT_FIELDS = {routeName: 80, version: 120, build: 40, browser: 80, os: 80};
const PAGE_MAX_LENGTH = 300;
const CLIENT_REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
// Client report time is kept only when it is close to server time
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

/**
 * Attachment types accepted by content sniffing. SVG and HTML are deliberately
 * absent because they can carry script when opened in the browser.
 */
const ATTACHMENT_SIGNATURES = [
    {mimeType: "image/png", extension: "png", matches: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])},
    {mimeType: "image/jpeg", extension: "jpg", matches: (b) => startsWith(b, [0xff, 0xd8, 0xff])},
    {mimeType: "image/gif", extension: "gif", matches: (b) => ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a"},
    {mimeType: "image/webp", extension: "webp", matches: (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP"},
    {mimeType: "video/webm", extension: "webm", matches: (b) => startsWith(b, [0x1a, 0x45, 0xdf, 0xa3])},
    {mimeType: "video/quicktime", extension: "mov", matches: (b) => ascii(b, 4, 4) === "ftyp" && ascii(b, 8, 4) === "qt  "},
    {mimeType: "video/mp4", extension: "mp4", matches: (b) => ascii(b, 4, 4) === "ftyp"},
];

/**
 * @param {Buffer} buffer
 * @param {number[]} bytes
 * @returns {boolean}
 */
function startsWith(buffer, bytes) {
    return buffer.length >= bytes.length && bytes.every((byte, i) => buffer[i] === byte);
}

/**
 * @param {Buffer} buffer
 * @param {number} offset
 * @param {number} length
 * @returns {string} ASCII text at the given offset, or "" when the buffer is too short
 */
function ascii(buffer, offset, length) {
    if (buffer.length < offset + length) {
        return "";
    }
    return buffer.toString("latin1", offset, offset + length);
}

/**
 * Detect an allowed attachment type from the file content (not the client-declared MIME type).
 *
 * @param {Buffer} buffer File content
 * @returns {{mimeType: string, extension: string}|null} Detected type, or null when not allowed
 */
function detectAttachmentType(buffer) {
    const match = ATTACHMENT_SIGNATURES.find((signature) => signature.matches(buffer));
    return match ? {mimeType: match.mimeType, extension: match.extension} : null;
}

const REDACTIONS = [
    // Bearer tokens and JWTs
    [/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [redacted]"],
    [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted]"],
    // key=value / key: value pairs whose key names a secret
    [/\b(password|passwd|pwd|token|secret|api[_-]?key|authorization|cookie|session(?:id)?|sid|access[_-]?token|refresh[_-]?token|csrf[_-]?token)\b(["']?\s*[:=]\s*["']?)[^\s"'&,;]+/gi, "$1$2[redacted]"],
    // Query strings and fragments can carry reset or login tokens
    [/(https?:\/\/[^\s?#]+)[?#]\S*/gi, "$1"],
    [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]"],
    // Long opaque strings (keys, hashes, session ids)
    [/[A-Za-z0-9+/_]{32,}={0,2}/g, "[redacted]"],
];

/**
 * Remove secrets, e-mail addresses and query strings from diagnostic text and cap its length.
 *
 * @param {*} value Untrusted value
 * @param {number} maxLength Maximum length of the result
 * @returns {string|null} Sanitized single-line text, or null when empty or not a string
 */
function sanitizeText(value, maxLength) {
    if (typeof value !== "string") {
        return null;
    }
    let text = value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
    for (const [pattern, replacement] of REDACTIONS) {
        text = text.replace(pattern, replacement);
    }
    if (text.length > maxLength) {
        text = text.slice(0, maxLength - 1) + "…";
    }
    return text || null;
}

/**
 * Reduce a page reference to its path: no origin, query string or fragment.
 *
 * @param {*} value Untrusted page value
 * @returns {string|null}
 */
function sanitizePath(value) {
    if (typeof value !== "string") {
        return null;
    }
    const path = value.replace(/^[a-z]+:\/\/[^/]*/i, "").split(/[?#]/)[0];
    return sanitizeText(path, PAGE_MAX_LENGTH);
}

/**
 * @param {*} value Untrusted timestamp
 * @returns {string|null} ISO timestamp, or null when invalid
 */
function sanitizeTime(value) {
    const time = typeof value === "string" || typeof value === "number" ? new Date(value) : null;
    return time && !Number.isNaN(time.getTime()) ? time.toISOString() : null;
}

/**
 * Keep only allow-listed, sanitized fields of one diagnostic event.
 *
 * @param {*} entry Untrusted diagnostic entry
 * @param {number} maxMessageLength Maximum length of the message field
 * @returns {Object|null} Sanitized entry, or null when the type or time is invalid
 */
function sanitizeDiagnosticEntry(entry, maxMessageLength) {
    if (!entry || typeof entry !== "object" || !DIAGNOSTIC_TYPES.includes(entry.type)) {
        return null;
    }
    const time = sanitizeTime(entry.time);
    if (!time) {
        return null;
    }
    const result = {type: entry.type, time};
    const message = sanitizeText(entry.message, maxMessageLength);
    if (message) {
        result.message = message;
    }
    for (const [field, maxLength] of Object.entries(DIAGNOSTIC_TEXT_FIELDS)) {
        const text = sanitizeText(entry[field], maxLength);
        if (text) {
            result[field] = text;
        }
    }
    for (const [field, {max, pattern}] of Object.entries(DIAGNOSTIC_ID_FIELDS)) {
        if (typeof entry[field] === "string" && entry[field].length <= max && pattern.test(entry[field])) {
            result[field] = entry[field];
        }
    }
    for (const field of DIAGNOSTIC_INT_FIELDS) {
        if (Number.isInteger(entry[field]) && entry[field] >= 0) {
            result[field] = entry[field];
        }
    }
    const path = sanitizePath(entry.path);
    if (path) {
        result.path = path;
    }
    return result;
}

/**
 * Sanitize the recent diagnostics list: drops entries older than the configured age
 * (relative to the report time) and keeps the newest entries when over the count limit.
 * A missing or malformed list yields an empty array so reports still submit without logs.
 *
 * @param {*} diagnostics Untrusted diagnostics
 * @param {Object} config Report settings (see loadReportSettings)
 * @param {string} reportedAt ISO report time the age limit is measured from
 * @returns {Object[]}
 */
function sanitizeDiagnostics(diagnostics, config, reportedAt) {
    if (!Array.isArray(diagnostics)) {
        return [];
    }
    const oldest = new Date(reportedAt).getTime() - config.diagnosticsMaxAgeMinutes * 60 * 1000;
    return diagnostics
        .slice(-HARD_LIMITS.diagnosticsMaxEntries)
        .map((entry) => sanitizeDiagnosticEntry(entry, config.diagnosticsMaxMessageLength))
        .filter((entry) => entry && new Date(entry.time).getTime() >= oldest)
        .slice(-config.diagnosticsMaxEntries);
}

/**
 * Sanitize the automatic context (page, report time, version, build, browser, OS).
 *
 * @param {*} context Untrusted context
 * @param {Date} now Server time
 * @returns {Object}
 */
function sanitizeContext(context, now = new Date()) {
    const source = context && typeof context === "object" ? context : {};
    const result = {page: sanitizePath(source.page)};
    for (const [field, maxLength] of Object.entries(CONTEXT_TEXT_FIELDS)) {
        result[field] = sanitizeText(source[field], maxLength);
    }
    const reportedAt = sanitizeTime(source.reportedAt);
    const withinSkew = reportedAt && Math.abs(new Date(reportedAt).getTime() - now.getTime()) <= MAX_CLOCK_SKEW_MS;
    result.reportedAt = withinSkew ? reportedAt : now.toISOString();
    return result;
}

/**
 * Display name for an attachment: no path parts or control characters.
 *
 * @param {*} name Untrusted file name
 * @param {string} extension Detected extension used when the name is empty
 * @returns {string}
 */
function sanitizeAttachmentName(name, extension) {
    const base = typeof name === "string" ? name.split(/[\\/]/).pop() : "";
    const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"|?*]+/g, "_").trim().slice(0, ATTACHMENT_NAME_MAX_LENGTH);
    return cleaned || `attachment.${extension}`;
}

/**
 * @param {*} value Setting value
 * @param {string[]} fallback Used when the value is not a string
 * @returns {string[]} Unique, valid comma-separated choice values (may be empty)
 */
function parseChoices(value, fallback) {
    if (typeof value !== "string") {
        return fallback;
    }
    const choices = value.split(",").map((choice) => choice.trim()).filter((choice) => CHOICE_PATTERN.test(choice));
    return [...new Set(choices)].slice(0, HARD_LIMITS.choices);
}

/**
 * @param {*} value Setting value
 * @param {number} fallback Used when the value is not a positive number
 * @param {number} max Fixed upper bound
 * @returns {number}
 */
function parseLimit(value, fallback, max) {
    const number = Number(value);
    if (value === null || value === undefined || value === "" || !Number.isFinite(number) || number <= 0) {
        return fallback;
    }
    return Math.min(number, max);
}

/**
 * @param {*} value Setting value
 * @param {boolean} fallback Used when the setting is missing
 * @returns {boolean}
 */
function parseFlag(value, fallback) {
    return value === null || value === undefined ? fallback : String(value) === "true";
}

/**
 * Read the "problemReport.*" settings and clamp them to the fixed safety bounds.
 * Missing or invalid values fall back to the defaults seeded by the settings migration.
 *
 * @param {function(string): Promise<string|null>} getSetting Returns the raw value of a setting key
 * @returns {Promise<Object>} Effective report configuration
 */
async function loadReportSettings(getSetting) {
    const keys = [
        "enabled", "problemTypes", "askBlocked", "frequencies", "description.maxLength", "reportsPerHour",
        "attachments.allowedTypes", "attachments.maxCount", "attachments.maxFileSizeMb", "attachments.maxTotalSizeMb",
        "diagnostics.maxEntries", "diagnostics.maxAgeMinutes", "diagnostics.maxMessageLength",
    ];
    const raw = {};
    for (const key of keys) {
        raw[key] = await getSetting("problemReport." + key);
    }
    const defaults = DEFAULT_SETTINGS;
    const mb = 1024 * 1024;
    const problemTypes = parseChoices(raw.problemTypes, defaults.problemTypes);
    const maxTotalBytes = Math.floor(parseLimit(raw["attachments.maxTotalSizeMb"], defaults.attachmentsMaxTotalBytes / mb, HARD_LIMITS.attachmentsMaxTotalBytes / mb) * mb);
    const maxFileBytes = Math.floor(parseLimit(raw["attachments.maxFileSizeMb"], defaults.attachmentsMaxFileBytes / mb, HARD_LIMITS.attachmentsMaxTotalBytes / mb) * mb);
    const allowedTypes = typeof raw["attachments.allowedTypes"] === "string"
        ? raw["attachments.allowedTypes"].split(",").map((type) => type.trim().toLowerCase())
        : defaults.attachmentTypes;
    return {
        enabled: parseFlag(raw.enabled, defaults.enabled),
        // A report needs at least one type to choose from
        problemTypes: problemTypes.length > 0 ? problemTypes : defaults.problemTypes,
        askBlocked: parseFlag(raw.askBlocked, defaults.askBlocked),
        frequencies: parseChoices(raw.frequencies, defaults.frequencies),
        descriptionMaxLength: Math.floor(parseLimit(raw["description.maxLength"], defaults.descriptionMaxLength, HARD_LIMITS.descriptionMaxLength)),
        reportsPerHour: Math.floor(parseLimit(raw.reportsPerHour, defaults.reportsPerHour, Number.MAX_SAFE_INTEGER)),
        // Settings can only narrow the content-sniffed allow-list, never add types such as SVG
        attachmentTypes: [...new Set(ATTACHMENT_SIGNATURES.map((signature) => signature.mimeType))]
            .filter((type) => allowedTypes.includes(type)),
        attachmentsMaxCount: Math.floor(parseLimit(raw["attachments.maxCount"], defaults.attachmentsMaxCount, HARD_LIMITS.attachmentsMaxCount)),
        attachmentsMaxFileBytes: Math.min(maxFileBytes, maxTotalBytes),
        attachmentsMaxTotalBytes: maxTotalBytes,
        diagnosticsMaxEntries: Math.floor(parseLimit(raw["diagnostics.maxEntries"], defaults.diagnosticsMaxEntries, HARD_LIMITS.diagnosticsMaxEntries)),
        diagnosticsMaxAgeMinutes: parseLimit(raw["diagnostics.maxAgeMinutes"], defaults.diagnosticsMaxAgeMinutes, HARD_LIMITS.diagnosticsMaxAgeMinutes),
        diagnosticsMaxMessageLength: Math.floor(parseLimit(raw["diagnostics.maxMessageLength"], defaults.diagnosticsMaxMessageLength, HARD_LIMITS.diagnosticsMaxMessageLength)),
    };
}

/**
 * Validate and normalize the user-entered and automatic parts of a report.
 * Attachments are validated separately in validateAttachments() because they need the file content.
 *
 * @param {Object} data Untrusted report payload
 * @param {Object} config Report settings (see loadReportSettings)
 * @param {Date} [now] Server time
 * @returns {{problemTypes: string[], blocked: boolean|null, frequency: string|null, description: string, context: Object, diagnostics: Object[]}}
 * @throws {TranslatableError} When required fields are missing or invalid
 */
function normalizeReport(data, config, now = new Date()) {
    const payload = data && typeof data === "object" ? data : {};

    const problemTypes = Array.isArray(payload.problemTypes)
        ? config.problemTypes.filter((type) => payload.problemTypes.includes(type))
        : [];
    if (problemTypes.length === 0) {
        throw new TranslatableError("errors.problemReport.problemTypeRequired");
    }

    const description = typeof payload.description === "string" ? payload.description.trim() : "";
    if (!description) {
        throw new TranslatableError("errors.problemReport.descriptionRequired");
    }
    if (description.length > config.descriptionMaxLength) {
        throw new TranslatableError("errors.problemReport.descriptionTooLong", {max: config.descriptionMaxLength});
    }

    const context = sanitizeContext(payload.context, now);
    return {
        problemTypes,
        blocked: config.askBlocked && typeof payload.blocked === "boolean" ? payload.blocked : null,
        frequency: config.frequencies.includes(payload.frequency) ? payload.frequency : null,
        description,
        context,
        diagnostics: sanitizeDiagnostics(payload.diagnostics, config, context.reportedAt),
    };
}

/**
 * Validate attachment count, size and content type.
 *
 * @param {*} attachments Untrusted list of {name, file}
 * @param {Object} config Report settings (see loadReportSettings)
 * @returns {{name: string, mimeType: string, extension: string, size: number, buffer: Buffer}[]}
 * @throws {TranslatableError} When an attachment violates a limit or has an unsupported type
 */
function validateAttachments(attachments, config) {
    if (attachments === undefined || attachments === null || (Array.isArray(attachments) && attachments.length === 0)) {
        return [];
    }
    if (!Array.isArray(attachments)) {
        throw new TranslatableError("errors.problemReport.invalidAttachment");
    }
    if (config.attachmentTypes.length === 0) {
        throw new TranslatableError("errors.problemReport.attachmentsDisabled");
    }
    if (attachments.length > config.attachmentsMaxCount) {
        throw new TranslatableError("errors.problemReport.tooManyAttachments", {max: config.attachmentsMaxCount});
    }
    const toMb = (bytes) => Math.round(bytes / (1024 * 1024) * 10) / 10;
    let total = 0;
    return attachments.map((attachment) => {
        const file = attachment && attachment.file;
        const buffer = Buffer.isBuffer(file) ? file : (file instanceof ArrayBuffer ? Buffer.from(file) : null);
        if (!buffer || buffer.length === 0) {
            throw new TranslatableError("errors.problemReport.invalidAttachment");
        }
        if (buffer.length > config.attachmentsMaxFileBytes) {
            throw new TranslatableError("errors.problemReport.attachmentTooLarge", {maxMb: toMb(config.attachmentsMaxFileBytes)});
        }
        total += buffer.length;
        if (total > config.attachmentsMaxTotalBytes) {
            throw new TranslatableError("errors.problemReport.attachmentsTooLarge", {maxMb: toMb(config.attachmentsMaxTotalBytes)});
        }
        const type = detectAttachmentType(buffer);
        if (!type || !config.attachmentTypes.includes(type.mimeType)) {
            throw new TranslatableError("errors.problemReport.unsupportedAttachmentType");
        }
        return {
            name: sanitizeAttachmentName(attachment.name, type.extension),
            mimeType: type.mimeType,
            extension: type.extension,
            size: buffer.length,
            buffer,
        };
    });
}

/**
 * @param {*} value Untrusted client request id
 * @returns {string}
 * @throws {TranslatableError} When the id is missing or malformed
 */
function validateClientRequestId(value) {
    if (typeof value !== "string" || !CLIENT_REQUEST_ID_PATTERN.test(value)) {
        throw new TranslatableError("errors.problemReport.invalidRequest");
    }
    return value;
}

module.exports = {
    HARD_LIMITS,
    DEFAULT_SETTINGS,
    detectAttachmentType,
    sanitizeText,
    sanitizeDiagnostics,
    sanitizeContext,
    loadReportSettings,
    normalizeReport,
    validateAttachments,
    validateClientRequestId,
};
