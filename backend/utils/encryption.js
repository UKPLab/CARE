/**
 * AES-256-GCM encryption utilities for sensitive user fields.
 *
 * Key source: DB_ENCRYPTION_KEY in .env
 * Must be a Base64-encoded 32-byte value.
 * Generate with: openssl rand -base64 32
 *
 * Storage format (Base64 string stored in TEXT column):
 *   base64( iv[12 bytes] + authTag[16 bytes] + ciphertext )
 *
 * decrypt() returns the input unchanged when the value is not encrypted,
 * so it is safe to call on legacy plaintext rows during migration.
 * @author karim ouf
 */


'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PROJECT_ROOT = path.resolve(__dirname, "../");
const KEY_FILE = path.join(PROJECT_ROOT, "encryption.key");
// Minimum byte length of a valid encrypted buffer: IV + authTag + 1 byte ciphertext
const MIN_ENCRYPTED_LENGTH = IV_LENGTH + AUTH_TAG_LENGTH + 1;

/**
 * Load and validate the encryption key from environment.
 * @returns {Buffer} 32-byte key
 */
function getKey() {
    const keyFilePath = KEY_FILE;

    if (!fs.existsSync(keyFilePath)) {
        throw new Error(
            `Encryption key file not found: ${keyFilePath}. ` +
            "Start the server once to generate it."
        );
    }

    const raw = fs.readFileSync(keyFilePath, "utf8").trim();

    if (!raw) {
        throw new Error("Encryption key file is empty.");
    }

    const key = Buffer.from(raw, "hex");

    if (key.length !== 32) {
        throw new Error(
            `Encryption key must decode to exactly 32 bytes (got ${key.length}).`
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

function initializeEncryptionKey() {
  const keyFile = KEY_FILE;

  if (fs.existsSync(keyFile)) {
    const key = fs.readFileSync(keyFile, "utf8").trim();
    console.log("Using existing encryption key");
    return key;
  }

  const key = crypto.randomBytes(32).toString("hex");

  fs.writeFileSync(keyFile, key, {
    encoding: "utf8",
    mode: 0o600, // owner read/write only
  });

  console.log("Generated new encryption key");
  return key;
}

module.exports = { encrypt, decrypt, initializeEncryptionKey, getKey };
