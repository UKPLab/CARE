/**
 * Helpers for choosing and applying the UI language (German or English).
 *
 * Where the language comes from:
 * 1. If the user saved a choice in Preferences → use localStorage key "locale"
 * 2. Otherwise → use the browser language (if we support it)
 * 3. Otherwise → English
 *
 * The language is stored only in the browser, not in the database.
 *
 * @author Andrii Nikitin
 */

/** @typedef {{ code: string, name: string, flag: string }} LocaleOption */

export const DEFAULT_LOCALE = "en";
const STORAGE_KEY = "locale";

/** @type {LocaleOption[]} */
export const SUPPORTED_LOCALES = [
    { code: "de", name: "Deutsch", flag: "🇩🇪" },
    { code: "en", name: "English", flag: "🇬🇧" },
];

const SUPPORTED_CODES = new Set(SUPPORTED_LOCALES.map((lang) => lang.code));

/**
 * Turns values like "de-DE" or "en-US" into "de" or "en".
 * Returns null if the app does not support that language.
 *
 * @param {string|null|undefined} locale
 * @returns {string|null}
 */
export function normalizeLocale(locale) {
    if (!locale || typeof locale !== "string") {
        return null;
    }
    const code = locale.toLowerCase().split("-")[0];
    return SUPPORTED_CODES.has(code) ? code : null;
}

/**
 * Returns the language the user saved in Preferences, or null if nothing was saved.
 *
 * @returns {string|null}
 */
export function getStoredLocale() {
    return normalizeLocale(localStorage.getItem(STORAGE_KEY));
}

/**
 * Saves the language to localStorage. Called when the user clicks Confirm in Preferences.
 *
 * @param {string} locale
 */
export function setStoredLocale(locale) {
    const normalized = normalizeLocale(locale);
    if (normalized) {
        localStorage.setItem(STORAGE_KEY, normalized);
    }
}

/**
 * Removes the saved locale preference (guest sessions use browser language again).
 */
export function clearStoredLocale() {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Picks a language from the browser settings (navigator.languages).
 * Uses the first entry we support (de or en). If none match, returns English.
 *
 * @returns {string}
 */
export function getBrowserLocale() {
    const candidates = navigator.languages?.length
        ? navigator.languages
        : [navigator.language];

    for (const candidate of candidates) {
        const normalized = normalizeLocale(candidate);
        if (normalized) {
            return normalized;
        }
    }
    return DEFAULT_LOCALE;
}

/**
 * Language used when the app starts (see file header for the order).
 *
 * @returns {string}
 */
export function getInitialLocale() {
    return getStoredLocale() || getBrowserLocale();
}

/**
 * Language for login, register, and similar pages before the user is logged in.
 * Same rules as on first load: saved choice, else browser, else English.
 *
 * @returns {string}
 */
export function getGuestLocale() {
    return getStoredLocale() || getBrowserLocale();
}

/**
 * True for routes like login, register, or reset-password (user not in the app yet).
 *
 * @param {import("vue-router").RouteLocationNormalized} route
 * @returns {boolean}
 */
export function isGuestAuthRoute(route) {
    return !!(
        route.meta.checkLogin
        || route.name === "register"
        || route.name === "reset-password"
    );
}

/**
 * Switches the active UI language in vue-i18n right away.
 *
 * @param {import("vue-i18n").I18n|{ locale: string }} i18nInstance
 * @param {string} locale
 * @returns {string} The locale code that was applied ("de" or "en")
 */
export function applyLocale(i18nInstance, locale) {
    const normalized = normalizeLocale(locale) || DEFAULT_LOCALE;
    const target = i18nInstance?.global ?? i18nInstance;
    if (!target) {
        return normalized;
    }

    if (typeof target.locale === "string") {
        target.locale = normalized;
    } else if (target.locale?.value !== undefined) {
        target.locale.value = normalized;
    }
    return normalized;
}
