/**
 * Helpers for choosing and applying the UI language (German or English).
 *
 * Logged-in users:
 * 1. `app.locale` from the server
 * 2. localStorage key "locale" until appSettings arrived
 * 3. Browser language, then English
 *
 * Preferences → `app.locale` in DB. Auth pages (`meta.checkLogin`) use browser language
 * and clear the localStorage cache when `/auth/check` returns no user.
 * After login, App.vue applies app.locale from appSettings when they arrive.
 *
 * @author Andrii Nikitin
 */

/** @typedef {{ code: string, name: string, flag: string }} LocaleOption */

/** Fallback when nothing else applies */
export const DEFAULT_LOCALE = "en";

/** Row key in `setting` (system default) and `user_setting` (per-user choice); same string in both tables. */
export const LOCALE_SETTING_KEY = "app.locale";

/** Browser localStorage key */
const STORAGE_KEY = "locale";

/** Languages shown in the language switcher */
export const SUPPORTED_LOCALES = [
    { code: "de", name: "Deutsch", flag: "🇩🇪" },
    { code: "en", name: "English", flag: "🇬🇧" },
];

/** Supported locale codes for fast lookup in {@link normalizeLocale} */
const SUPPORTED_CODES = new Set(SUPPORTED_LOCALES.map((lang) => lang.code));

/**
 * Normalizes a locale tag to a supported app code.
 *
 * @param {string|null|undefined} locale - `"de"` / `"en"` from the app, or a browser tag like `"de-DE"` / `"en-US"`
 * @returns {string|null} code e.g. `"de"` or `"en"` when supported; otherwise `null`
 */
export function normalizeLocale(locale) {
    if (!locale || typeof locale !== "string") {
        return null;
    }
    const code = locale.toLowerCase().split("-")[0];
    return SUPPORTED_CODES.has(code) ? code : null;
}

/**
 * Reads the locale saved in the browser.
 *
 * Called at app boot (before mount), so a blocked `localStorage` (e.g. an embedded
 * iframe with storage restrictions) must not throw here — that would stop the app
 * from mounting at all.
 *
 * @returns {string|null} Normalized code from `localStorage`, or `null` if unset, unsupported, or unreadable
 */
export function getStoredLocale() {
    try {
        return normalizeLocale(localStorage.getItem(STORAGE_KEY));
    } catch {
        return null;
    }
}

/**
 * Saves the language to localStorage.
 *
 * @param {string} locale clear code e.g. `"de"` or `"en"`
 */
export function setStoredLocale(locale) {
    localStorage.setItem(STORAGE_KEY, locale);
}

/**
 * Removes the cached UI locale from browser localStorage (stored under key `"locale"`).
 */
export function clearCachedLocale() {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Picks a language from the browser settings
 * Uses the first entry we support. If none match, returns English.
 *
 * @returns {string} First supported code from `navigator.languages`, or {@link DEFAULT_LOCALE}
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
 * Language used when the app starts in main.js (before the router runs).
 *
 * @returns {string} localStorage cache, or browser locale
 */
export function getInitialLocale() {
    return getStoredLocale() || getBrowserLocale();
}

/**
 * Reads `app.locale` from merged app settings.
 *
 * @param {Object|null|undefined} settings - Merged `setting` + `user_setting` from `appSettings`
 * @returns {string|null} Normalized locale code, or `null` if missing or unsupported
 */
export function getLocaleFromSettings(settings) {
    if (!settings || typeof settings !== "object") {
        return null;
    }
    return normalizeLocale(settings[LOCALE_SETTING_KEY]);
}

/**
 * Browser locale for routes with `meta.checkLogin` (login, register, …). Ignores localStorage cache.
 *
 * @returns {string} Browser locale, or {@link DEFAULT_LOCALE}
 */
export function getAuthPageLocale() {
    return getBrowserLocale();
}

/**
 * Applies a locale to a vue-i18n instance.
 *
 * @param {import("vue-i18n").I18n} i18nInstance - export from main.js
 * @param {string} locale - `"de"` or `"en"`
 */
export function applyLocale(i18nInstance, locale) {
    const normalized = normalizeLocale(locale) || DEFAULT_LOCALE;
    i18nInstance.global.locale = normalized;
}
