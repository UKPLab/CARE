/**
 * TranslatableError - Custom error class for i18n support
 *
 * Throw with an i18n key (and optional params / code) instead of a hardcoded string.
 * Catch handlers read key, params, and code for the frontend; use resolveLogText(key, params)
 * for English log messages.
 *
 * @example
 * throw new TranslatableError('errors.auth.invalidCredentials');
 *
 * @example
 * throw new TranslatableError('errors.nlp.timeout', { skill: 'summarization' });
 *
 * @example
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
}

module.exports = TranslatableError;
