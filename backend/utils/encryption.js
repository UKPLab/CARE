/**
 * AES-256-GCM encryption utilities for sensitive user fields.
 *
 * Key source: DB_ENCRYPTION_KEY (or DB_ENCRYPTIAN_KEY) in .env
 * Must be a Base64-encoded 32-byte value.
 * Generate with: openssl rand -base64 32
 *
 * Storage format (Base64 string stored in TEXT column):
 *   base64( iv[12 bytes] + authTag[16 bytes] + ciphertext )
 *
 * decrypt() returns the input unchanged when the value is not encrypted,
 * so it is safe to call on legacy plaintext rows during migration.
 */

'use strict';

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
// Minimum byte length of a valid encrypted buffer: IV + authTag + 1 byte ciphertext
const MIN_ENCRYPTED_LENGTH = IV_LENGTH + AUTH_TAG_LENGTH + 1;

/**
 * Load and validate the encryption key from environment.
 * @returns {Buffer} 32-byte key
 */
function getKey() {
    const raw = process.env.DB_ENCRYPTION_KEY || process.env.DB_ENCRYPTIAN_KEY;
    if (!raw) {
        throw new Error(
            'DB_ENCRYPTION_KEY must be set in .env. ' +
            'Generate one with: openssl rand -base64 32'
        );
    }
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
        throw new Error(
            `DB_ENCRYPTION_KEY must decode to exactly 32 bytes (got ${key.length}). ` +
            'Generate a valid key with: openssl rand -base64 32'
        );
    }
    return key;
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Each call uses a fresh random IV so the same plaintext produces different ciphertext.
 *
 * @param {string|null|undefined} plaintext
 * @returns {string|null} Base64-encoded encrypted string, or null for null/undefined input
 */
function encrypt(plaintext) {
    if (plaintext === null || plaintext === undefined) return null;

    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

    const ciphertext = Buffer.concat([
        cipher.update(String(plaintext), 'utf8'),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Pack: iv (12) | authTag (16) | ciphertext
    return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

/**
 * Decrypt a Base64 string produced by encrypt().
 * Returns the value as-is if it does not look like an encrypted string
 * (e.g. a legacy plaintext value still in the DB).
 *
 * @param {string|null|undefined} value
 * @returns {string|null} Decrypted plaintext, or original value if not encrypted, or null
 */
function decrypt(value) {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return value;

    let packed;
    try {
        packed = Buffer.from(value, 'base64');
    } catch {
        return value; // not valid Base64 → plaintext
    }

    if (packed.length < MIN_ENCRYPTED_LENGTH) {
        return value; // too short to be an encrypted value → plaintext
    }

    try {
        const key = getKey();
        const iv = packed.subarray(0, IV_LENGTH);
        const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
        decipher.setAuthTag(authTag);

        return decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8');
    } catch {
        // Wrong key, corrupted data, or a plaintext string that happens to be valid Base64
        return value;
    }
}

/**
 * Returns true if the value looks like it was produced by encrypt().
 * Useful in migration scripts to skip rows that are already encrypted.
 *
 * @param {string|null|undefined} value
 * @returns {boolean}
 */
function isEncrypted(value) {
    if (!value || typeof value !== 'string') return false;
    try {
        return Buffer.from(value, 'base64').length >= MIN_ENCRYPTED_LENGTH;
    } catch {
        return false;
    }
}

module.exports = { encrypt, decrypt, isEncrypted };
