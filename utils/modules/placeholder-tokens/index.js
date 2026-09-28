/**
 * Parse and format placeholder tokens in template text (~key~, ~key[N]~, ~key[N]{options}~).
 *
 * Placeholders in a template are written as tilded tokens in the editor text, for example
 * ~pdfText[1]~ or ~submissionFiles[2]{wordRange:1-500}~. That string is the placeholder
 * token — it is not the placeholder definition row in the database.
 *
 * This module reads, builds, and substitutes those tokens in the template editor
 * and during template resolution.
 *
 * @author Mohammad Elwan
 */

/** Matches ~placeholderKey~, ~placeholderKey[N]~, and optional {name:value,...}. */
const PLACEHOLDER_TOKEN_REGEX = /~([A-Za-z0-9_]+)(?:\[(\d+)\])?(?:\{([^}]*)\})?~/g;

/**
 * Walk comma-separated name:value pairs inside placeholder option braces.
 *
 * @param {string} optionsStr - Raw text inside `{...}`
 * @param {Function} callback - `(name, value) => void`
 * @returns {void}
 */
function forEachOptionPart(optionsStr, callback) {
    if (!optionsStr || typeof optionsStr !== "string") {
        return;
    }
    const trimmed = optionsStr.trim();
    if (!trimmed) {
        return;
    }
    for (const part of trimmed.split(",")) {
        const segment = part.trim();
        if (!segment) {
            continue;
        }
        const colonIndex = segment.indexOf(":");
        if (colonIndex <= 0) {
            continue;
        }
        const name = segment.slice(0, colonIndex).trim();
        const value = segment.slice(colonIndex + 1).trim();
        if (name) {
            callback(name, value);
        }
    }
}

/**
 * Parse comma-separated name:value pairs inside placeholder option braces.
 *
 * @param {string} optionsStr - Raw text inside `{...}`
 * @returns {Object} Map of option name to string value
 */
function parseOptionsString(optionsStr) {
    const options = {};
    forEachOptionPart(optionsStr, (name, value) => {
        options[name] = value;
    });
    return options;
}

/**
 * Option names that appear more than once in `{...}` (parse keeps the last value).
 *
 * @param {string} optionsStr - Raw text inside `{...}`
 * @returns {string[]} Duplicate names, first-seen order
 */
function getDuplicateOptionNames(optionsStr) {
    const seen = new Set();
    const duplicates = [];
    forEachOptionPart(optionsStr, (name) => {
        if (seen.has(name)) {
            if (!duplicates.includes(name)) {
                duplicates.push(name);
            }
            return;
        }
        seen.add(name);
    });
    return duplicates;
}

/**
 * Full tokens whose `{...}` repeats an option name.
 *
 * @param {string} text - Template plain text
 * @returns {string[]} Token strings e.g. ~pdfText[1]{wordRange:1,wordRange:500}~
 */
function getTokensWithDuplicateOptions(text) {
    if (!text) {
        return [];
    }
    const regex = new RegExp(PLACEHOLDER_TOKEN_REGEX.source, "g");
    const tokens = [];
    let match = regex.exec(text);
    while (match) {
        if (getDuplicateOptionNames(match[3] || "").length > 0) {
            tokens.push(match[0]);
        }
        match = regex.exec(text);
    }
    return tokens;
}

/**
 * Format option map as `{name:value,...}` suffix, or empty string when none.
 *
 * @param {Object} [options] - Option name/value map
 * @returns {string}
 */
function formatOptionsString(options) {
    if (!options || typeof options !== "object") {
        return "";
    }
    const parts = [];
    for (const [name, value] of Object.entries(options)) {
        if (name && value !== undefined && value !== null && String(value).trim() !== "") {
            parts.push(`${name}:${String(value).trim()}`);
        }
    }
    if (parts.length === 0) {
        return "";
    }
    return `{${parts.join(",")}}`;
}

/**
 * Parse capture groups from PLACEHOLDER_TOKEN_REGEX exec result.
 *
 * @param {RegExpExecArray} match - Regex exec result
 * @returns {Object} `{ baseKey, index, options }` (`index` is null when the token has no `[N]`)
 */
function parsePlaceholderMatch(match) {
    if (!match || !match[1]) {
        return { baseKey: "", index: null, options: {} };
    }
    return {
        baseKey: match[1],
        index: match[2] ? parseInt(match[2], 10) : null,
        options: parseOptionsString(match[3] || ""),
    };
}

/**
 * Whether an option value is a positive integer string.
 *
 * @param {string} value - Raw option value
 * @returns {boolean}
 */
function isPositiveIntegerOptionValue(value) {
    if (value === undefined || value === null || String(value).trim() === "") {
        return false;
    }
    const parsed = parseInt(String(value), 10);
    return Number.isInteger(parsed) && parsed > 0 && String(parsed) === String(value).trim();
}

/** Placeholder keys that support wordRange / pageRange token options. */
const RANGE_LIMIT_PLACEHOLDER_KEYS = ["pdfText", "submissionFiles", "editorText"];

/**
 * Whether `baseKey` is `pdfText`, `submissionFiles`, or `editorText` (those keys call `applyTextRangeLimit`).
 *
 * @param {string} baseKey - Placeholder key
 * @returns {boolean}
 */
function supportsRangeLimit(baseKey) {
    return RANGE_LIMIT_PLACEHOLDER_KEYS.includes(baseKey);
}

/**
 * Parse a 1-based inclusive range. A single number N means 1–N (first N units).
 *
 * @param {string|number} value - Raw option value (`500` or `2-4`)
 * @returns {{from: number, to: number}|null} Parsed range, or null when invalid
 */
function parsePositiveIntegerRange(value) {
    if (value === undefined || value === null) {
        return null;
    }
    const trimmed = String(value).trim();
    if (!trimmed) {
        return null;
    }
    if (isPositiveIntegerOptionValue(trimmed)) {
        const to = parseInt(trimmed, 10);
        return { from: 1, to };
    }
    const match = /^(\d+)-(\d+)$/.exec(trimmed);
    if (!match) {
        return null;
    }
    const from = parseInt(match[1], 10);
    const to = parseInt(match[2], 10);
    if (from < 1 || to < from) {
        return null;
    }
    return { from, to };
}

/**
 * Whether an option value is a valid positive integer range string.
 *
 * @param {string} value - Raw option value
 * @returns {boolean}
 */
function isPositiveIntegerRangeOptionValue(value) {
    return parsePositiveIntegerRange(value) != null;
}

/**
 * Format from/to sidebar inputs as a range option string.
 *
 * A lone `to` is stored as `N` (first N units). A lone `from` is stored as `N-N`.
 *
 * @param {string|number} fromRaw - Start (1-based), optional
 * @param {string|number} toRaw - End (1-based), optional
 * @returns {string} Range string, or empty when invalid
 */
function formatPositiveIntegerRange(fromRaw, toRaw) {
    const fromText = fromRaw === undefined || fromRaw === null ? "" : String(fromRaw).trim();
    const toText = toRaw === undefined || toRaw === null ? "" : String(toRaw).trim();
    if (!fromText && isPositiveIntegerOptionValue(toText)) {
        return toText;
    }
    if (isPositiveIntegerOptionValue(fromText) && !toText) {
        return `${fromText}-${fromText}`;
    }
    if (isPositiveIntegerOptionValue(fromText) && isPositiveIntegerOptionValue(toText)) {
        const from = parseInt(fromText, 10);
        const to = parseInt(toText, 10);
        if (to < from) {
            return "";
        }
        if (from === 1) {
            return String(to);
        }
        return `${from}-${to}`;
    }
    return "";
}

/**
 * Page texts from a resolved placeholder value (string or `{ pages }`).
 *
 * @param {*} value - Resolved value
 * @returns {string[]}
 */
function pagesFromPlaceholderValue(value) {
    if (value && typeof value === "object" && Array.isArray(value.pages)) {
        return value.pages.map((page) => (typeof page === "string" ? page : String(page ?? "")));
    }
    if (typeof value === "string") {
        return value ? [value] : [];
    }
    if (value === undefined || value === null) {
        return [];
    }
    try {
        return [JSON.stringify(value)];
    } catch (_error) {
        return [String(value)];
    }
}

/**
 * Apply optional wordRange / pageRange from a token instance.
 * When both are set, pages are sliced first, then words on that text.
 *
 * @param {*} value - Resolved string or `{ pages, pageCount }`
 * @param {Object} [tokenOptions] - Parsed token options
 * @returns {string}
 */
function applyTextRangeLimit(value, tokenOptions = {}) {
    let pages = pagesFromPlaceholderValue(value);
    const pageRange = parsePositiveIntegerRange(tokenOptions.pageRange);
    if (pageRange) {
        pages = pages.slice(pageRange.from - 1, pageRange.to);
    }
    const text = pages.join("\n");
    const wordRange = parsePositiveIntegerRange(tokenOptions.wordRange);
    if (!wordRange) {
        return text;
    }
    const words = text.trim() ? text.trim().split(/\s+/) : [];
    return words.slice(wordRange.from - 1, wordRange.to).join(" ");
}

/**
 * Format a bracket-indexed placeholder token.
 *
 * @param {string} baseKey - Placeholder key without tildes
 * @param {number} index - Placeholder index
 * @param {Object} [options] - Optional name/value map written inside `{...}`
 * @returns {string} Token string e.g. ~link[3]{wordRange:1-500}~
 */
function formatPlaceholderToken(baseKey, index, options) {
    const optionsPart = formatOptionsString(options);
    return `~${baseKey}[${index}]${optionsPart}~`;
}

/**
 * Inner text between tildes for mapping and hook value keys.
 *
 * @param {string} baseKey - Placeholder key
 * @param {number} index - Placeholder index
 * @returns {string} Inner token text e.g. submissionFiles[2]
 */
function tokenInnerText(baseKey, index) {
    return `${baseKey}[${index}]`;
}

/**
 * List indexes used for a placeholder key in template text.
 *
 * @param {string} text - Template plain text or HTML scan text
 * @param {string} baseKey - Placeholder key
 * @returns {Array} Sorted unique indexes
 */
function getUsedIndexes(text, baseKey) {
    if (!text || !baseKey) {
        return [];
    }
    const indexes = [];
    const regex = new RegExp(PLACEHOLDER_TOKEN_REGEX.source, "g");
    let match;
    while ((match = regex.exec(text)) !== null) {
        const parsed = parsePlaceholderMatch(match);
        if (parsed.baseKey === baseKey && parsed.index != null) {
            indexes.push(parsed.index);
        }
    }
    return [...new Set(indexes)].sort((a, b) => a - b);
}

/**
 * Next index to assign when adding a placeholder from the sidebar.
 *
 * @param {string} text - Template content scan text
 * @param {string} baseKey - Placeholder key
 * @returns {number} Next index (max existing + 1, or 1)
 */
function getNextPlaceholderIndex(text, baseKey) {
    const indexes = getUsedIndexes(text, baseKey);
    if (indexes.length === 0) {
        return 1;
    }
    return Math.max(...indexes) + 1;
}

/**
 * Count placeholder instances per base key.
 *
 * @param {string} text - Template content scan text
 * @param {Object} [options] - Options
 * @param {boolean} [options.bracketOnly] - When true, skip unbracketed ~key~ tokens (default: false)
 * @returns {Object} Map of placeholder key to occurrence count
 */
function countPlaceholdersByKey(text, options = {}) {
    const { bracketOnly = false } = options;
    const counts = {};
    if (!text) {
        return counts;
    }
    const regex = new RegExp(PLACEHOLDER_TOKEN_REGEX.source, "g");
    let match;
    while ((match = regex.exec(text)) !== null) {
        const parsed = parsePlaceholderMatch(match);
        if (!parsed.baseKey) {
            continue;
        }
        if (bracketOnly && parsed.index == null) {
            continue;
        }
        counts[parsed.baseKey] = (counts[parsed.baseKey] || 0) + 1;
    }
    return counts;
}

/**
 * Whether a required placeholder key appears in content.
 *
 * @param {string} text - Template content
 * @param {string} baseKey - Placeholder key
 * @param {Object} [options] - Options
 * @param {boolean} [options.bracketOnly] - When true, require ~key[N]~ only (default: false)
 * @returns {boolean}
 */
function hasPlaceholderForKey(text, baseKey, options = {}) {
    const { bracketOnly = false } = options;
    if (!text || !baseKey) {
        return false;
    }
    if (!bracketOnly && text.includes(`~${baseKey}~`)) {
        return true;
    }
    return getUsedIndexes(text, baseKey).length > 0;
}

/**
 * Find duplicate ~key[N]~ tokens (same key and same index).
 * Unbracketed ~key~ tokens are not checked.
 *
 * @param {string} text - Template content
 * @param {string} baseKeyFilter - Optional placeholder key filter
 * @returns {Array} Duplicate key/index pairs
 */
function getDuplicatePlaceholderIndexes(text, baseKeyFilter) {
    const seen = new Map();
    const duplicates = [];
    if (!text) {
        return duplicates;
    }
    const regex = new RegExp(PLACEHOLDER_TOKEN_REGEX.source, "g");
    let match;
    while ((match = regex.exec(text)) !== null) {
        const parsed = parsePlaceholderMatch(match);
        if (!parsed.baseKey || parsed.index == null) {
            continue;
        }
        if (baseKeyFilter && parsed.baseKey !== baseKeyFilter) {
            continue;
        }
        const indexKey = String(parsed.index);
        if (!seen.has(parsed.baseKey)) {
            seen.set(parsed.baseKey, new Map());
        }
        const indexMap = seen.get(parsed.baseKey);
        indexMap.set(indexKey, (indexMap.get(indexKey) || 0) + 1);
    }
    for (const [key, indexMap] of seen) {
        for (const [indexKey, count] of indexMap) {
            if (count > 1) {
                duplicates.push({
                    key,
                    index: parseInt(indexKey, 10),
                });
            }
        }
    }
    return duplicates;
}

/**
 * Format a duplicate entry as a token string for error messages.
 *
 * @param {Object} entry - Duplicate placeholder entry
 * @returns {string} Token string e.g. ~link[2]~
 */
function formatDuplicatePlaceholderToken(entry) {
    return formatPlaceholderToken(entry.key, entry.index);
}

/**
 * Replace placeholder tokens using a resolver callback.
 *
 * Non-null values are converted with `String(value)`.
 *
 * @param {string} text - Input text
 * @param {Function} resolveValue - Resolver `(baseKey, index, options) => value`
 * @returns {string} Text with placeholders replaced
 */
function applyPlaceholderReplacements(text, resolveValue) {
    if (!text || typeof resolveValue !== "function") {
        return text || "";
    }
    const regex = new RegExp(PLACEHOLDER_TOKEN_REGEX.source, "g");
    return text.replace(regex, (match, baseKey, indexStr, optionsStr) => {
        const index = indexStr ? parseInt(indexStr, 10) : null;
        const options = parseOptionsString(optionsStr || "");
        const value = resolveValue(baseKey, index, options);
        if (value === undefined || value === null) {
            return match;
        }
        return String(value);
    });
}

module.exports = {
    PLACEHOLDER_TOKEN_REGEX,
    RANGE_LIMIT_PLACEHOLDER_KEYS,
    parseOptionsString,
    getDuplicateOptionNames,
    getTokensWithDuplicateOptions,
    formatOptionsString,
    parsePlaceholderMatch,
    isPositiveIntegerOptionValue,
    supportsRangeLimit,
    parsePositiveIntegerRange,
    isPositiveIntegerRangeOptionValue,
    formatPositiveIntegerRange,
    pagesFromPlaceholderValue,
    applyTextRangeLimit,
    formatPlaceholderToken,
    tokenInnerText,
    getUsedIndexes,
    getNextPlaceholderIndex,
    countPlaceholdersByKey,
    hasPlaceholderForKey,
    getDuplicatePlaceholderIndexes,
    formatDuplicatePlaceholderToken,
    applyPlaceholderReplacements,
};
