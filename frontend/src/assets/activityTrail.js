/**
 * Recent activity trail for problem reports.
 *
 * Fed by the BehaviorLogger (see App.vue), which only runs while the user agrees
 * to usage statistics; App.vue clears the trail when that consent is withdrawn.
 * Nothing here is sent anywhere by itself: the trail is only read when the user
 * opens the problem report form, where it is shown before submitting.
 *
 * Only structural metadata is kept: event type and time, coordinates, scroll
 * positions, window focus and tab visibility, page paths without query string,
 * and for clicked elements the tag name, an allow-listed ARIA role and input type
 * and the tag names of a few ancestors. Ids, classes, names, labels, text, typed
 * values and keys are never read, because they can contain user content.
 *
 * @author Akash Gundapuneni
 */

// Fixed safety bounds; the configured (smaller) limits are applied when reading and again on the server
export const HARD_MAX_ENTRIES = 500;
export const HARD_MAX_AGE_MINUTES = 60;
export const MIN_SAMPLE_MS = 200;
const ANCESTORS_MAX = 6;

const ROLES = new Set([
    "button", "link", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "tab", "checkbox", "radio",
    "switch", "textbox", "combobox", "listbox", "slider", "spinbutton", "dialog", "navigation", "toolbar",
    "row", "gridcell", "cell", "columnheader", "treeitem", "img", "presentation",
]);
const INPUT_TYPES = new Set([
    "button", "checkbox", "color", "date", "datetime-local", "email", "file", "hidden", "image", "month", "number",
    "password", "radio", "range", "reset", "search", "submit", "tel", "text", "time", "url", "week",
]);
const TAG_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;

let entries = [];
const lastSample = {mouseMove: 0, scroll: 0};

/**
 * @param {*} element DOM element
 * @returns {string|null} Lower-case tag name, or null for non-elements
 */
function tagOf(element) {
    const tag = element && typeof element.tagName === "string" ? element.tagName.toLowerCase() : null;
    return tag && TAG_PATTERN.test(tag) ? tag : null;
}

/**
 * Structural description of an element: no id, class, name, label or text.
 *
 * @param {*} element Event target
 * @param {Array} [path] event.composedPath()
 * @returns {Object|undefined}
 */
export function describeElement(element, path) {
    const tag = tagOf(element);
    if (!tag) {
        return undefined;
    }
    const result = {tag};
    const role = typeof element.getAttribute === "function" ? element.getAttribute("role") : null;
    if (ROLES.has(role)) {
        result.role = role;
    }
    if (tag === "input" && INPUT_TYPES.has(String(element.type).toLowerCase())) {
        result.inputType = String(element.type).toLowerCase();
    }
    const ancestors = (Array.isArray(path) ? path.slice(1) : [])
        .map(tagOf)
        .filter((name) => name && name !== "html" && name !== "body")
        .slice(0, ANCESTORS_MAX);
    if (ancestors.length > 0) {
        result.ancestors = ancestors;
    }
    return result;
}

/**
 * @param {*} value Coordinate
 * @returns {number|undefined}
 */
function coordinate(value) {
    return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : undefined;
}

/**
 * @returns {string|undefined} Current path without query string or fragment
 */
function currentPath() {
    return typeof window !== "undefined" && window.location ? window.location.pathname : undefined;
}

/**
 * @param {string} type Sampled event type
 * @param {number} now Current time in ms
 * @param {number} sampleMs Configured sampling interval
 * @returns {boolean} Whether this event is taken as a sample
 */
function takeSample(type, now, sampleMs) {
    const interval = Math.max(MIN_SAMPLE_MS, Number(sampleMs) || 1000);
    if (now - lastSample[type] < interval) {
        return false;
    }
    lastSample[type] = now;
    return true;
}

/**
 * Turn one BehaviorLogger event into a safe trail entry.
 *
 * @param {string} type click, mouseMove, scroll, windowFocus, visibility or navigation
 * @param {Object} event DOM event, or {focused}, {hidden}, {path} for the non-DOM types
 * @param {number} sampleMs Sampling interval for mouseMove and scroll
 * @param {number} now Current time in ms
 * @returns {Object|null} Entry, or null when skipped
 */
export function toActivityEntry(type, event, sampleMs, now = Date.now()) {
    const base = {type, time: new Date(now).toISOString()};
    switch (type) {
        case "click":
            return {
                ...base,
                x: coordinate(event.clientX),
                y: coordinate(event.clientY),
                path: currentPath(),
                element: describeElement(event.target, typeof event.composedPath === "function" ? event.composedPath() : []),
            };
        case "mouseMove":
            if (!takeSample(type, now, sampleMs)) return null;
            return {
                ...base,
                x: coordinate(event.clientX),
                y: coordinate(event.clientY),
                scrollX: coordinate(window.scrollX),
                scrollY: coordinate(window.scrollY),
            };
        case "scroll": {
            if (!takeSample(type, now, sampleMs)) return null;
            const target = event.target;
            const isElement = target && tagOf(target);
            return {
                ...base,
                scrollX: coordinate(isElement ? target.scrollLeft : window.scrollX),
                scrollY: coordinate(isElement ? target.scrollTop : window.scrollY),
                element: isElement ? describeElement(target) : undefined,
            };
        }
        case "windowFocus":
            return {...base, focused: event.focused === true};
        case "visibility":
            return {...base, hidden: event.hidden === true};
        case "navigation":
            return {...base, path: typeof event.path === "string" ? event.path.split(/[?#]/)[0] : undefined};
        default:
            return null;
    }
}

/**
 * Record one event. Called by the BehaviorLogger, so only while statistics consent is given.
 *
 * @param {string} type Event type (see toActivityEntry)
 * @param {Object} event DOM event or plain data
 * @param {number} sampleMs Sampling interval for mouseMove and scroll
 * @returns {void}
 */
export function recordActivity(type, event, sampleMs) {
    const entry = toActivityEntry(type, event || {}, sampleMs);
    if (!entry) {
        return;
    }
    entries.push(Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== undefined)));
    if (entries.length > HARD_MAX_ENTRIES) {
        entries.splice(0, entries.length - HARD_MAX_ENTRIES);
    }
}

/**
 * Recent entries within the configured limits, oldest first.
 *
 * @param {Object} limits
 * @param {number} [limits.maxEntries]
 * @param {number} [limits.maxAgeMinutes]
 * @param {number} [now] Current time in ms
 * @returns {Object[]} Copies of the entries
 */
export function getActivity({maxEntries, maxAgeMinutes} = {}, now = Date.now()) {
    const count = Math.min(Number(maxEntries) || HARD_MAX_ENTRIES, HARD_MAX_ENTRIES);
    const ageMs = Math.min(Number(maxAgeMinutes) || HARD_MAX_AGE_MINUTES, HARD_MAX_AGE_MINUTES) * 60 * 1000;
    return entries
        .filter((entry) => now - new Date(entry.time).getTime() <= ageMs)
        .slice(-count)
        .map((entry) => JSON.parse(JSON.stringify(entry)));
}

/**
 * Drop the whole trail (consent withdrawn, logout, feature turned off).
 *
 * @returns {void}
 */
export function clearActivity() {
    entries = [];
    lastSample.mouseMove = 0;
    lastSample.scroll = 0;
}
