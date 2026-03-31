const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get the encryption key from environment or derive a fallback.
 * Production deployments MUST set LLM_ENCRYPTION_KEY (64 hex chars = 32 bytes).
 * @returns {Buffer}
 */
function getEncryptionKey() {
    const envKey = process.env.LLM_ENCRYPTION_KEY;
    if (envKey && envKey.length === 64) {
        return Buffer.from(envKey, 'hex');
    }
    const secret = process.env.CONTENT_SERVER_SECRET || 'care-default-dev-secret';
    return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a hex string: IV (32 hex) + AuthTag (32 hex) + Ciphertext (variable hex)
 * @param {string} plaintext
 * @returns {string} hex-encoded encrypted payload
 */
function encrypt(plaintext) {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return iv.toString('hex') + authTag.toString('hex') + encrypted;
}

/**
 * Decrypt a hex-encoded AES-256-GCM payload back to plaintext.
 * @param {string} encryptedHex - output of encrypt()
 * @returns {string} decrypted plaintext
 */
function decrypt(encryptedHex) {
    const key = getEncryptionKey();

    const iv = Buffer.from(encryptedHex.slice(0, IV_LENGTH * 2), 'hex');
    const authTag = Buffer.from(encryptedHex.slice(IV_LENGTH * 2, IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2), 'hex');
    const ciphertext = encryptedHex.slice(IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

/**
 * Mask an API key for display (show first 4 and last 4 characters).
 * @param {string} key
 * @returns {string}
 */
function maskApiKey(key) {
    if (!key || key.length <= 8) return '****';
    return key.slice(0, 4) + '...' + key.slice(-4);
}

module.exports = {encrypt, decrypt, maskApiKey};
