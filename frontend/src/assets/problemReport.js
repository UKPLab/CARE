/**
 * Shared helpers for the problem report popup and the admin report pages.
 *
 * Choice lists and limits come from the "problemReport.*" settings; the backend
 * enforces the same settings (clamped to fixed safety caps), so values read here
 * only drive rendering and early client-side feedback.
 *
 * @author Akash Gundapuneni
 */

// Stable choice values seeded by the settings migration; other configured values are shown as entered
const CHOICE_LABEL_KEYS = {
    problemTypes: {
        error: "problemReport.types.error",
        wrongOrMissing: "problemReport.types.wrongOrMissing",
        slowOrStuck: "problemReport.types.slowOrStuck",
        otherOrSuggestion: "problemReport.types.otherOrSuggestion",
    },
    frequencies: {
        firstTime: "problemReport.frequencies.firstTime",
        sometimes: "problemReport.frequencies.sometimes",
        everyTime: "problemReport.frequencies.everyTime",
        notSure: "problemReport.frequencies.notSure",
    },
};

const DIAGNOSTIC_TYPE_KEYS = {
    error: "problemReport.diagnosticTypes.error",
    unhandledRejection: "problemReport.diagnosticTypes.unhandledRejection",
    vueError: "problemReport.diagnosticTypes.vueError",
    failedOperation: "problemReport.diagnosticTypes.failedOperation",
    connection: "problemReport.diagnosticTypes.connection",
    navigation: "problemReport.diagnosticTypes.navigation",
};

const ACTIVITY_TYPE_KEYS = {
    click: "problemReport.activityTypes.click",
    mouseMove: "problemReport.activityTypes.mouseMove",
    scroll: "problemReport.activityTypes.scroll",
    windowFocus: "problemReport.activityTypes.windowFocus",
    visibility: "problemReport.activityTypes.visibility",
    navigation: "problemReport.activityTypes.navigation",
};

/**
 * Translated label for a configured choice value.
 *
 * @param {Function} t vue-i18n translate function
 * @param {"problemTypes"|"frequencies"} kind Choice list
 * @param {string} value Choice value
 * @returns {string}
 */
export function choiceLabel(t, kind, value) {
    const key = CHOICE_LABEL_KEYS[kind][value];
    return key ? t(key) : value;
}

/**
 * @param {Function} t vue-i18n translate function
 * @param {string} type Diagnostic event type
 * @returns {string}
 */
export function diagnosticTypeLabel(t, type) {
    return DIAGNOSTIC_TYPE_KEYS[type] ? t(DIAGNOSTIC_TYPE_KEYS[type]) : type;
}

/**
 * @param {Function} t vue-i18n translate function
 * @param {string} type Activity event type
 * @returns {string}
 */
export function activityTypeLabel(t, type) {
    return ACTIVITY_TYPE_KEYS[type] ? t(ACTIVITY_TYPE_KEYS[type]) : type;
}

/**
 * One-line description of a stored activity entry (structural metadata only).
 *
 * @param {Function} t vue-i18n translate function
 * @param {Object} entry Sanitized activity entry
 * @returns {string}
 */
export function describeActivity(t, entry) {
    const parts = [];
    if (entry.element) {
        const element = entry.element;
        let text = element.tag;
        if (element.role) text += ` role=${element.role}`;
        if (element.inputType) text += ` type=${element.inputType}`;
        if (element.ancestors && element.ancestors.length > 0) text += ` (in ${element.ancestors.join(" › ")})`;
        parts.push(text);
    }
    if (entry.x !== undefined && entry.y !== undefined) parts.push(`x ${entry.x}, y ${entry.y}`);
    if (entry.scrollX !== undefined || entry.scrollY !== undefined) {
        parts.push(t("problemReport.activity.scrollPosition", { x: entry.scrollX ?? 0, y: entry.scrollY ?? 0 }));
    }
    if (entry.focused !== undefined) parts.push(t(entry.focused ? "problemReport.activity.focused" : "problemReport.activity.blurred"));
    if (entry.hidden !== undefined) parts.push(t(entry.hidden ? "problemReport.activity.hidden" : "problemReport.activity.visible"));
    if (entry.path) parts.push(entry.path);
    return parts.join(" · ");
}

/**
 * The user's answers as the backend saves them (trimmed description, configured choices only).
 * Used to show the answers below the form while the user types.
 *
 * @param {Object} form {problemTypes, blocked, frequency}
 * @param {string} description Description text
 * @param {Object} settings Effective report settings
 * @returns {{problemTypes: string[], blocked: boolean|null, frequency: string|null, description: string}}
 */
export function normalizeAnswers(form, description, settings) {
    return {
        problemTypes: settings.problemTypes.filter((type) => (form.problemTypes || []).includes(type)),
        blocked: settings.askBlocked && typeof form.blocked === "boolean" ? form.blocked : null,
        frequency: settings.frequencies.includes(form.frequency) ? form.frequency : null,
        description: typeof description === "string" ? description.trim() : "",
    };
}

/**
 * @param {*} value Comma-separated setting value
 * @returns {string[]}
 */
function parseList(value) {
    if (typeof value !== "string") {
        return [];
    }
    return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

/**
 * @param {*} value Numeric setting value
 * @returns {number|null} Positive number, or null when unset or invalid
 */
function parsePositive(value) {
    const number = Number(value);
    return value !== undefined && value !== null && value !== "" && Number.isFinite(number) && number > 0 ? number : null;
}

/**
 * Report settings from the settings store.
 *
 * @param {Function} getValue settings/getValue getter
 * @returns {Object} Parsed settings; enabled is false when the settings are missing
 */
export function readReportSettings(getValue) {
    const mb = 1024 * 1024;
    const maxFileSizeMb = parsePositive(getValue("problemReport.attachments.maxFileSizeMb"));
    const maxTotalSizeMb = parsePositive(getValue("problemReport.attachments.maxTotalSizeMb"));
    return {
        enabled: String(getValue("problemReport.enabled")) === "true",
        problemTypes: parseList(getValue("problemReport.problemTypes")),
        askBlocked: String(getValue("problemReport.askBlocked")) === "true",
        frequencies: parseList(getValue("problemReport.frequencies")),
        descriptionMaxLength: parsePositive(getValue("problemReport.description.maxLength")),
        attachmentTypes: parseList(getValue("problemReport.attachments.allowedTypes")).map((type) => type.toLowerCase()),
        attachmentsMaxCount: parsePositive(getValue("problemReport.attachments.maxCount")),
        attachmentsMaxFileBytes: maxFileSizeMb ? maxFileSizeMb * mb : null,
        attachmentsMaxTotalBytes: maxTotalSizeMb ? maxTotalSizeMb * mb : null,
        maxFileSizeMb,
        maxTotalSizeMb,
        activityEnabled: String(getValue("problemReport.activity.enabled")) === "true",
        activityMaxEntries: parsePositive(getValue("problemReport.activity.maxEntries")),
        activityMaxAgeMinutes: parsePositive(getValue("problemReport.activity.maxAgeMinutes")),
    };
}

/**
 * Browser and operating system names with major versions from the user agent.
 *
 * @param {string} userAgent navigator.userAgent
 * @returns {{browser: string|null, os: string|null}}
 */
function describeUserAgent(userAgent) {
    const ua = userAgent || "";
    const browsers = [
        ["Edge", /Edg(?:e|A|iOS)?\/(\d+)/],
        ["Opera", /OPR\/(\d+)/],
        ["Firefox", /(?:Firefox|FxiOS)\/(\d+)/],
        ["Chrome", /(?:Chrome|CriOS)\/(\d+)/],
        ["Safari", /Version\/(\d+)[^ ]* (?:Mobile\/\S+ )?Safari\//],
    ];
    const systems = [
        ["Windows", /Windows NT/],
        ["iOS", /iPhone|iPad|iPod/],
        ["Android", /Android/],
        ["macOS", /Mac OS X/],
        ["ChromeOS", /CrOS/],
        ["Linux", /Linux/],
    ];
    const browser = browsers.find(([, pattern]) => pattern.test(ua));
    const os = systems.find(([, pattern]) => pattern.test(ua));
    return {
        browser: browser ? `${browser[0]} ${ua.match(browser[1])[1]}` : null,
        os: os ? os[0] : null,
    };
}

/**
 * Automatic report context: page, capture time, CARE version/build, browser, OS and viewport size.
 *
 * @param {Object} route Current vue-router route
 * @returns {Object}
 */
export function buildReportContext(route) {
    return {
        page: route ? route.path : window.location.pathname,
        routeName: route && route.name ? String(route.name) : null,
        reportedAt: new Date().toISOString(),
        version: typeof APP_VERSION !== "undefined" ? APP_VERSION : null,
        build: import.meta.env.MODE,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        ...describeUserAgent(navigator.userAgent),
    };
}

/**
 * @param {number} bytes File size
 * @returns {string} Size in KB or MB
 */
export function formatBytes(bytes) {
    if (bytes < 1024 * 1024) {
        return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
