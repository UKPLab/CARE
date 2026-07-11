import "file-saver"; // DO NOT delete this import, required for window.saveAs to work
import Papa from "papaparse";
import yaml from "js-yaml";
import { i18n } from '../main.js';

// Detects key-like messages such as "errors.server.notFound".
// This prevents missing translation keys from being shown as raw text,
// while still allowing legacy plain text backend messages to pass through.
const looksLikeI18nKey = (str) =>
    typeof str === 'string' &&
    /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)+$/.test(str);

/**
 * Translates a value when it is a known i18n key; otherwise returns it unchanged.
 * Use for DB seed strings and metadata that may be either an i18n key
 * or user-entered plain text.
 *
 * @param {*} value String to translate, or any other value passed through as-is.
 * @param {Object} [params={}] Values for placeholders in the translated text, e.g. { name: "Anna" } when the string is "Hello {name}".
 * @returns {*} Translated string, the original string if no key exists, or the input unchanged when not a string.
 */
export function translateMaybeKey(value, params = {}) {
    if (typeof value !== 'string') {
        return value;
    }
    if (i18n.global.te(value)) {
        return i18n.global.t(value, params);
    }
    return value;
}

/**
 * Resolves a user-facing message from an API/socket response.
 * Prefers structured i18n payloads ({ key, params }) over legacy plain-text messages.
 *
 * @param {Object|null|undefined} response API response object.
 * @param {string} [response.key] i18n key to translate.
 * @param {Object} [response.params] Interpolation values for response.key or response.message.
 * @param {string} [response.message] Legacy plain text or i18n key string.
 * @param {string} [fallbackKey='errors.server.unknownError'] Key used when translation is missing or response is empty.
 * @returns {string} Localized message for display (toast, modal, etc.).
 */
export function resolveApiMessage(response, fallbackKey = 'errors.server.unknownError') {
    const fallbackMessage = i18n.global.t(fallbackKey);

    if (response && response.key) {
        if (i18n.global.te(response.key)) {
            return i18n.global.t(response.key, response.params || {});
        }

        console.warn('[i18n] Missing API key:', response.key, response);
        return fallbackMessage;
    }

    if (response && response.message) {
        if (i18n.global.te(response.message)) {
            return i18n.global.t(response.message, response.params || {});
        }

        if (looksLikeI18nKey(response.message)) {
            console.warn('[i18n] Missing message key:', response.message, response);
            return fallbackMessage;
        }

        console.warn('[i18n] Legacy plain API message:', response.message, response);
        return response.message;
    }

    console.warn('[i18n] Empty API response message:', response);
    return fallbackMessage;
}

/**
 * Returns the active vue-i18n locale code (e.g. "en", "de").
 *
 * @returns {string|undefined}
 */
function getCurrentLocale() {
    const locale = i18n?.global?.locale;
    if (typeof locale === "string") {
        return locale;
    }
    return locale?.value;
}

/**
 * Turns a date from the API/UI into a real Date object.
 * Returns null if the value is empty or not a valid date (e.g. null, "", "not-a-date").
 *
 * @param {*} value A Date, ISO string (e.g. "2026-05-29T12:00:00Z"), or timestamp number.
 * @returns {Date|null} Usable Date, or null when there is nothing to format.
 */
function toValidDate(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Formats a date using the current app locale (date only, no time).
 *
 * @param {*} value Date, ISO string, or timestamp.
 * @param {Intl.DateTimeFormatOptions} [options={}] Options passed to Date.prototype.toLocaleDateString.
 * @returns {string} Formatted date, or "" when value is invalid or empty.
 */
export function formatLocalizedDate(value, options = {}) {
    const date = toValidDate(value);
    if (!date) return "";
    return date.toLocaleDateString(getCurrentLocale(), options);
}

/**
 * Formats a time using the current app locale (time only, no date).
 *
 * @param {*} value Date, ISO string, or timestamp.
 * @param {Intl.DateTimeFormatOptions} [options={}] Options passed to Date.prototype.toLocaleTimeString.
 * @returns {string} Formatted time, or "" when value is invalid or empty.
 */
export function formatLocalizedTime(value, options = {}) {
    const date = toValidDate(value);
    if (!date) return "";
    return date.toLocaleTimeString(getCurrentLocale(), options);
}

/**
 * Formats a date and time using the current app locale.
 *
 * @param {*} value Date, ISO string, or timestamp.
 * @param {Intl.DateTimeFormatOptions} [options={}] Options passed to Date.prototype.toLocaleString.
 * @returns {string} Formatted date-time, or "" when value is invalid or empty.
 */
export function formatLocalizedDateTime(value, options = {}) {
    const date = toValidDate(value);
    if (!date) return "";
    return date.toLocaleString(getCurrentLocale(), options);
}

/**
 * Returns a copy of the object, for which only the provided attributes by keys are included (whitelisting).
 * src: https://stackoverflow.com/questions/17781472/how-to-get-a-subset-of-a-javascript-objects-properties
 *
 * @param obj the object to be reduced (remains unchanged)
 * @param keys the keys to be included
 * @returns {Object}
 */
export function pickObjectAttributeSubset(obj, keys) {
    return Object.fromEntries(keys.filter(key => key in obj).map(key => [key, obj[key]]));
}

/**
 * Returns a copy of the object, for which only the attributes are included, which do not match any of the keys
 * (blacklisting).
 * src: https://stackoverflow.com/questions/17781472/how-to-get-a-subset-of-a-javascript-objects-properties
 *
 * @param obj the object to be reduced (remains unchagned)
 * @param keys the keys to NOT be included
 * @returns {Object}
 */
export function omitObjectAttributeSubset(obj, keys) {
    return Object.fromEntries(Object.entries(obj).filter(([key]) => !keys.includes(key)));
}

/**
 * Returns a copy of the first argument object, where the attributes are replaced by the contents of the second
 * argument object, iff the attribute is present in the latter.
 *
 * @param obj_orig object to be copied
 * @param obj_over object to override attributes of the first object
 * @returns {Object}
 */
export function overrideObjectAttributes(obj_orig, obj_over) {
    return Object.fromEntries(Object.entries(obj_orig).map(([key, value]) => [key, key in obj_over ? obj_over[key] : value]));
}

/**
 * Returns a CSV version of the provided object. Requires Papa parse formatting.
 *
 * @param objs
 * @returns {*}
 */
export function objectsToCSV(objs) {
    return Papa.unparse(objs);
}

/**
 * Returns a JSON string of the provided objects (including pretty printing).
 *
 * @param objs
 * @returns {string}
 */
export function objectsToJSON(objs) {
    return JSON.stringify(objs, null, 2);
}

/**
 * Returns a YAML string of the provided objects.
 *
 * @param objs
 * @returns {string}
 */
export function objectsToYAML(objs) {
    return yaml.dump(objs, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: true
    });
}

/**
 * Exports a list of objects into a single string, where nested objects are visualized by indentation.
 *
 * @param objs
 * @returns {String}
 */
export function objectsToTXT(objs) {
    return objs.map(o => Object.entries(o).map(([k, v]) => {
            if (typeof v === "object" && v !== null) {
                return `${k}\n${objectsToTXT([v])}`;
            } else if (v === null) {
                return `${k}:-`;
            } else {
                return `${k}:  ${v}`;
            }
        }).join("\n")
    ).join("\n\n");
}

/**
 * Maps each supported export format to its serializer and MIME type.
 * This is the single source of truth for downloadObjectsAs and getSupportedExportFormats.
 */
const EXPORT_FORMATS = {
    csv: {
        serialize:   objectsToCSV,
        mimeType:    "text/csv",
        label:       "modals.importExport.formats.csv.label",
        icon:        "filetype-csv",
        description: "modals.importExport.formats.csv.description",
        extensions:  [".csv"],
    },
    json: {
        serialize:   objectsToJSON,
        mimeType:    "application/json",
        label:       "modals.importExport.formats.json.label",
        icon:        "filetype-json",
        description: "modals.importExport.formats.json.description",
        extensions:  [".json"],
        parse:       (content) => JSON.parse(content),
    },
    txt: {
        serialize:   objectsToTXT,
        mimeType:    "text/plain",
        label:       "modals.importExport.formats.txt.label",
        icon:        "filetype-txt",
        description: "modals.importExport.formats.txt.description",
        extensions:  [".txt"],
    },
    yaml: {
        serialize:   objectsToYAML,
        mimeType:    "application/x-yaml",
        label:       "modals.importExport.formats.yaml.label",
        icon:        "filetype-yml",
        description: "modals.importExport.formats.yaml.description",
        extensions:  [".yaml", ".yml"],
        parse:       (content) => yaml.load(content),
    },
};

/**
 * Returns all supported export formats for downloadObjectsAs.
 *
 * @returns {string[]}
 */
export function getSupportedExportFormats() {
    return Object.entries(EXPORT_FORMATS).map(([key, { label, icon, description }]) => ({ key, label, icon, description }));
}

/**
 * Returns all formats that can be parsed back for import (i.e. those with a parse function).
 *
 * @returns {{ key: string, label: string, icon: string, description: string, extensions: string[], parse: function }[]}
 */
export function getSupportedImportFormats() {
    return Object.entries(EXPORT_FORMATS)
        .filter(([, fmt]) => typeof fmt.parse === "function")
        .map(([key, { label, icon, description, extensions, parse }]) => ({ key, label, icon, description, extensions, parse }));
}

/**
 * Downloads the provided objects by the given file type under the given file name.
 *
 * @param objs objects to be downloaded in the browser
 * @param name name of the resulting file
 * @param file_type the type of the file, either {"csv" | "json" | "txt" | "yaml"}
 */
export function downloadObjectsAs(objs, name, file_type) {
    const format = EXPORT_FORMATS[file_type];
    if (!format) {
        throw `Invalid argument '${file_type}' passed to downloadObjectsAs`;
    }
    const data = format.serialize(objs);
    window.saveAs(new Blob([data], {type: `${format.mimeType};charset=utf-8`}), `${name}.${file_type}`);
}

/**
 * Checks whether two arrays are identical.
 * src: https://stackoverflow.com/questions/6229197/how-to-know-if-two-arrays-have-the-same-values/55614659#55614659
 *
 * @param a1
 * @param a2
 * @returns {boolean}
 */
export function arraysContainSameElements(a1, a2) {
    const superSet = {};
    for (const i of a1) {
        const e = i + typeof i;
        superSet[e] = 1;
    }

    for (const i of a2) {
        const e = i + typeof i;
        if (!superSet[e]) {
            return false;
        }
        superSet[e] = 2;
    }

    for (let e in superSet) {
        if (superSet[e] === 1) {
            return false;
        }
    }

    return true;
}

/**
 * Returns a human readable time string representing the time difference between two timestamps. The  string
 * adapts to the magnitude of the difference.
 *
 * @param start
 * @param end
 * @returns {string}
 */
export function getTimeDiffString(start, end) {
    let delta = Math.abs(end - start) / 1000;

    const days = Math.floor(delta / 86400);
    delta -= days * 86400;

    const hours = Math.floor(delta / 3600) % 24;
    delta -= hours * 3600;

    const minutes = Math.floor(delta / 60) % 60;
    delta -= minutes * 60;

    const seconds = Math.floor(delta % 60);

    if (days > 0) {
        return `${days} day${days > 1 ? "s" : ""}`;
    } else if (hours > 0) {
        return `${hours} hour${hours > 1 ? "s" : ""} and ${minutes} minute${minutes > 1 ? "s" : ""}`;
    } else if (minutes > 0) {
        return `${minutes} minute${minutes > 1 ? "s" : ""}`;
    } else {
        return `${seconds} second${seconds > 1 ? "s" : ""}`;
    }
}

/**
 * Downloads a document as a file.
 * @param content the written content inside of the document
 * @param fileName the name of the file
 * @param fileType the type of the file
 */
export function downloadDocument(content, fileName, fileType = "") {
    let typeSet;
    switch (fileType) {
        case "PDF":
            typeSet = "application/pdf";
            // Ensure fileName ends with .pdf
            fileName = fileName.replace(/\.pdf$/i, "") + ".pdf"; // Remove any trailing .pdf and add .pdf
            break;
        case "html":
            typeSet = "text/html;charset=utf-8";
            break;
        case "json":
            typeSet = "application/json;charset=utf-8";
            break;
        case "csv":
            typeSet = "text/csv;charset=utf-8";
            break;
        case "txt":
        default:
            typeSet = "text/plain;charset=utf-8";
            break;
    }

    const blob = new Blob([content], {type: typeSet});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.setAttribute("href", url);
    anchor.setAttribute("target", "_blank");
    anchor.style.visibility = "hidden";
    anchor.setAttribute("download", fileName);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
}


/**
 * Sort the data in a graph according to a previous key
 * @param key Key to sort the data
 * @returns {[]}
 */
export const sortGraph = function (key) {
    if (!key) {
        return this;
    }
    const data = this;
    const sorted = [];
    let current = data.find(item => item[key] === null);

    // find next element and add it to the sorted array
    while (current) {
        sorted.push(current);
        current = data.find(item => item[key] === current.id);
    }

    return sorted;
}

/**
 * This function sorts a list of objects according to the provided list of sorters objects.
 * @param arrayToSort list of objects to sort
 * @param sortList list of objects with the keys "type" and "key" to sort the list
 * @returns {[]}
 */
export const sorter = function(arrayToSort, sortList) {
    if (!sortList) {
        return arrayToSort;
    }
    let sortedList = arrayToSort;
    for (let sort of sortList) {
        switch(sort.type) {
            case "graph":
                sortedList = sortGraph.call(sortedList, sort.key);
                break;
            default:
                break;
        }
    }
    return sortedList;

}

/**
 * Returns "#000000" or "#ffffff" depending on which provides better contrast
 * against the given hex background colour, using the W3C relative luminance
 * formula (WCAG 2.x).
 *
 * @param {string} hexColor - A 7-char hex colour string (e.g. "#ffe599")
 * @returns {string} "#000000" or "#ffffff"
 */
export function getContrastColor(hexColor) {
    const hex = (hexColor || "").replace(/^#/, "");
    if (hex.length !== 6) return "#000000";
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    const toLinear = (c) =>
        c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const luminance =
        0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    return luminance > 0.179 ? "#000000" : "#ffffff";
}

/**
 * Extracts text content from a PDF document using PDF.js
 * @param {Object} pdfDocument - The PDF.js document object
 * @returns {Promise<string>} A promise that resolves to the extracted text
 */
export async function extractTextFromPDF(pdfDocument) {
    let fullText = '';
    
    // Loop through all pages
    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Extract text from the page and normalize whitespace
        const pageText = textContent.items
            .map(item => item.str)
            .join(' ')
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
            
        fullText += pageText + '\n';
    }
    
    return fullText;
}