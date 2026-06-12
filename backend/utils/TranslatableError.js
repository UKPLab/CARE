/**
 * TranslatableError - Custom error class for i18n support
 *
 * This error class allows throwing errors with translation keys instead of
 * hardcoded strings. The error can then be:
 * - Translated to English for logging (using the i18n utility)
 * - Sent to the frontend as a key for client-side translation
 *
 * @example
 * // Simple error with just a key
 * throw new TranslatableError('errors.auth.invalidCredentials');
 *
 * @example
 * // Error with interpolation parameters
 * throw new TranslatableError('errors.nlp.timeout', { skill: 'summarization' });
 *
 * @example
 * // Error with parameters and optional machine-readable code (frontend branching)
 * throw new TranslatableError('errors.assignment.unableToAssignEnoughDocuments', {
 *   roleName: 'Reviewer',
 *   count: 5
 * }, 'ASSIGNMENT_FAILED');
 *
 * @example
 * // Key + params + optional code (when params are present)
 * throw new TranslatableError('errors.documents.fileMissingFromServer', { filename }, 'FILE_MISSING');
 *
 * For code + key only (no params), use generateError(code, key) instead — avoids null placeholders.
 */

const i18n = require('./i18n');

class TranslatableError extends Error {
    /**
     * Creates a new TranslatableError
     *
     * @param {string} key - The translation key (e.g., 'errors.auth.invalidCredentials')
     * @param {Object|null} [params] - Optional parameters for interpolation
     * @param {string|null} [code] - Optional machine-readable code (use when params are also present;
     *     for code + key without params, prefer generateError(code, key))
     */
    constructor(key, params = null, code = null) {
        // Call parent constructor with the key as message
        // This ensures stack traces show the key
        super(key);

        // Maintain proper stack trace for where the error was thrown (V8 engines)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, TranslatableError);
        }

        this.name = 'TranslatableError';
        this.key = key;
        if (params) {
            this.params = params;
        }
        if (code) {
            this.code = code;
        }

        // Flag to identify translatable errors in catch blocks
        this.isTranslatable = true;
    }

    /**
     * Gets the English translation of this error for logging purposes
     *
     * @returns {string} - The translated error message in English
     */
    getLocalizedMessage() {
        return i18n.t(this.key, this.params || {});
    }

    /**
     * Serializes the error for sending to the frontend
     * The frontend can use this to translate the error to the user's locale
     *
     * @returns {Object} - Object with key and params for frontend translation
     */
    toJSON() {
        const result = {key: this.key};
        if (this.params) {
            result.params = this.params;
        }
        if (this.code) {
            result.code = this.code;
        }
        return result;
    }

    /**
     * Returns the English translation when converting to string
     * Useful for logging and debugging
     *
     * @returns {string} - The translated error message
     */
    toString() {
        return `${this.name}: ${this.getLocalizedMessage()}`;
    }
}

module.exports = TranslatableError;
