/**
 * Parse and format placeholder tokens in template text (~key~, ~key[N]~, ~key[N]{options}~).
 *
 * Placeholders in a template are written as tilded tokens in the editor text, for example
 * ~pdfText[1]~ or ~submissionFiles[2]{characterLimit:5000}~. That string is the placeholder
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
 * Parse comma-separated name:value pairs inside placeholder option braces.
 *
 * @param {string} optionsStr - Raw text inside `{...}`
 * @returns {Object} Map of option name to string value
 */
function parseOptionsString(optionsStr) {
    const options = {};
    if (!optionsStr || typeof optionsStr !== "string") {
        return options;
    }
    const trimmed = optionsStr.trim();
    if (!trimmed) {
        return options;
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
            options[name] = value;
        }
    }
    return options;
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
 * @returns {Object} Parsed placeholder token
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

/**
 * Format a bracket-indexed placeholder token.
 *
 * @param {string} baseKey - Placeholder key without tildes
 * @param {number} index - Placeholder index
 * @param {Object} [options] - Optional name/value map written inside `{...}`
 * @returns {string} Token string e.g. ~link[3]{characterLimit:5000}~
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
    parseOptionsString,
    formatOptionsString,
    parsePlaceholderMatch,
    isPositiveIntegerOptionValue,
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
