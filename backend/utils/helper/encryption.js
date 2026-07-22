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
const STATE_FILE = path.join(PROJECT_ROOT, "encryption.state");
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
 * @param {Buffer|string} [key]  32-byte key — defaults to the key stored in encryption.key
 * @returns {string|null} Base64-encoded encrypted string, or null for null/undefined input
 */
function encrypt(plaintext, key) {
    if (plaintext === null || plaintext === undefined) return null;

    const resolvedKey = key ? parseKey(key) : getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, resolvedKey, iv, { authTagLength: AUTH_TAG_LENGTH });

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

/**
 * Parse a key argument that may be a 32-byte Buffer or a 64-char hex string.
 * @param {Buffer|string} keyInput
 * @returns {Buffer}
 */
function parseKey(keyInput) {
    if (Buffer.isBuffer(keyInput)) {
        if (keyInput.length !== 32) throw new Error(`Key buffer must be 32 bytes (got ${keyInput.length}).`);
        return keyInput;
    }
    if (typeof keyInput === 'string') {
        const buf = Buffer.from(keyInput, 'hex');
        if (buf.length !== 32) throw new Error(`Key hex must decode to 32 bytes (got ${buf.length}).`);
        return buf;
    }
    throw new Error('Key must be a Buffer or a hex string.');
}

/**
 * HMAC-SHA256 of plaintext using the encryption key.
 * Use this as the value for a {field}Hash column when the plaintext field is encrypted but must remain uniquely queryable.
 * Keyed hash prevents offline enumeration (unlike plain SHA256).
 */
function hashForUnique(plaintext) {
    if (plaintext === null || plaintext === undefined) return null;
    return crypto.createHmac('sha256', getKey()).update(String(plaintext)).digest('hex');
}

/**
 * Re-encrypt a single value from the current key (read from file) to newKey.
 * decrypt() uses the file key, which is still the old key at rotation time.
 *
 * - If the value is null/undefined it is returned as-is.
 * - If the value does not decrypt (not encrypted, or wrong key) it is returned unchanged.
 *
 * @param {string|null|undefined} encryptedValue  Value currently stored in the DB
 * @param {Buffer|string} newKey                  32-byte key to re-encrypt with
 * @returns {string|null}                         Value re-encrypted with newKey, or original if not encrypted
 */
function reEncryptValue(encryptedValue, newKey) {
    if (encryptedValue === null || encryptedValue === undefined) return null;
    if (typeof encryptedValue !== 'string') return encryptedValue;

    const newKeyBuf = parseKey(newKey);
    const plaintext = decrypt(encryptedValue);

    // decrypt() returns the original value when decryption fails
    if (plaintext === encryptedValue) return encryptedValue;

    return encrypt(plaintext, newKeyBuf);
}

/**
 * Iterate every model table that declares `encryptedFields`, apply `transformFn` to each
 * field value, and persist the results. Each table runs in its own transaction.
 *
 * @param {object}   db           The db object exported from backend/db
 * @param {Function} transformFn  (value: string) => string  — called for every non-null field value
 * @returns {Promise<Array<{model: string, total: number, updated: number}>>}
 */
async function _applyToAllModels(db, transformFn) {
    const { sequelize, models } = db;
    const results = [];

    for (const [modelName, Model] of Object.entries(models)) {
        const fields = Model.options && Model.options.encryptedFields;
        if (!fields || fields.length === 0) continue;

        const tableName = Model.tableName;
        const pk = Model.primaryKeyAttribute || 'id';

        const transaction = await sequelize.transaction();
        const fieldNames = fields.map(f => typeof f === 'string' ? f : f.name);
        try {
            const rows = await sequelize.query(
                `SELECT "${pk}", ${fieldNames.map(f => `"${f}"`).join(', ')} FROM "${tableName}"`,
                { type: sequelize.QueryTypes.SELECT, transaction }
            );

            let updated = 0;
            for (const row of rows) {
                const updates = {};
                for (const field of fieldNames) {
                    if (row[field] != null) {
                        updates[field] = transformFn(row[field]);
                    }
                }
                if (Object.keys(updates).length > 0) {
                    const setClauses = Object.keys(updates).map(col => `"${col}" = :${col}`).join(', ');
                    await sequelize.query(
                        `UPDATE "${tableName}" SET ${setClauses} WHERE "${pk}" = :pk`,
                        { replacements: { ...updates, pk: row[pk] }, transaction }
                    );
                    updated++;
                }
            }

            await transaction.commit();
            results.push({ model: modelName, total: rows.length, updated });
        } catch (err) {
            await transaction.rollback();
            throw Object.assign(err, { model: modelName });
        }
    }

    return results;
}

/**
 * Re-encrypt all encryptedFields using the current file key as the old key and newKey as the new key.
 * @param {object} db  The db object exported from backend/db
 * @param {Buffer|string} newKey
 */
async function reEncryptAllModels(db, newKey) {
    const newKeyBuf = parseKey(newKey);
    return _applyToAllModels(db, value => reEncryptValue(value, newKeyBuf));
}

/**
 * Decrypt all encryptedFields back to plaintext.
 * Call this when ENCRYPTION_ENABLED is switched from true → false.
 * @param {object} db  The db object exported from backend/db
 */
async function decryptAllModels(db) {
    return _applyToAllModels(db, value => decrypt(value));
}

/**
 * Encrypt all encryptedFields using the current key.
 * Call this when ENCRYPTION_ENABLED is switched from false → true.
 * Safe to re-run: values already encrypted are decrypted first to avoid double-encryption.
 * @param {object} db  The db object exported from backend/db
 */
async function encryptAllModels(db) {
    return _applyToAllModels(db, value => encrypt(decrypt(value)));
}

/**
 * Detect changes to ENCRYPTION_ENABLED and automatically encrypt or decrypt all model tables.
 * Compares the current env value against the last recorded state in encryption.state.
 * On the very first call (no state file) the state is recorded without migrating data,
 * since the migration is responsible for the initial encryption.
 *
 * @param {object} db  The db object exported from backend/db
 */
async function syncEncryptionState(db) {
    const isEnabled = process.env.ENCRYPTION_ENABLED === 'true';

    if (!fs.existsSync(STATE_FILE)) {
        fs.writeFileSync(STATE_FILE, String(isEnabled), { encoding: 'utf8', mode: 0o600 });
        return;
    }

    const wasEnabled = fs.readFileSync(STATE_FILE, 'utf8').trim() === 'true';
    if (isEnabled === wasEnabled) return;

    if (isEnabled) {
        console.log('[encryption] ENCRYPTION_ENABLED changed to true — encrypting all fields...');
        const results = await encryptAllModels(db);
        for (const { model, total, updated } of results) {
            console.log(`  [${model}] encrypted ${updated}/${total} row(s)`);
        }
    } else {
        console.log('[encryption] ENCRYPTION_ENABLED changed to false — decrypting all fields...');
        const results = await decryptAllModels(db);
        for (const { model, total, updated } of results) {
            console.log(`  [${model}] decrypted ${updated}/${total} row(s)`);
        }
    }

    fs.writeFileSync(STATE_FILE, String(isEnabled), { encoding: 'utf8', mode: 0o600 });
}

/**
 * Generate a cryptographically secure random AES-256 key.
 * @returns {string} 64-character lowercase hex string (32 bytes)
 */
function generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * For each model with uniqueEncryptedFields, ensures the {field}Hash column exists in the DB,
 * back-fills HMAC hashes for any rows missing them, then adds a unique constraint.
 * Safe to call on every startup — all steps are idempotent.
 *
 * @param {object} db  The db object exported from backend/db
 */
async function syncHashColumns(db) {
    if (process.env.ENCRYPTION_ENABLED !== 'true') return;
    const { DataTypes } = require('sequelize');
    const { sequelize, models } = db;
    const qi = sequelize.getQueryInterface();

    for (const [, Model] of Object.entries(models)) {
        const encryptedFields = Model.options?.encryptedFields || [];
        if (!encryptedFields.length) continue;
        const uniqueFields = encryptedFields.filter(f => typeof f !== 'string' && f.unique).map(f => f.name);
        if (!uniqueFields.length) continue;

        const tableName = Model.tableName;
        let tableDesc;
        try {
            tableDesc = await qi.describeTable(tableName);
        } catch {
            continue; // table doesn't exist yet (migrations haven't run)
        }

        const pk = Model.primaryKeyAttribute || 'id';

        for (const fieldName of uniqueFields) {
            const hashField = `${fieldName}Hash`;
            const isNew = !tableDesc[hashField];

            if (isNew) {
                await qi.addColumn(tableName, hashField, { type: DataTypes.STRING, allowNull: true, unique: true });
            }

            // Back-fill rows where the hash is missing
            const rows = await sequelize.query(
                `SELECT "${pk}", "${fieldName}" FROM "${tableName}" WHERE "${hashField}" IS NULL AND "${fieldName}" IS NOT NULL`,
                { type: sequelize.QueryTypes.SELECT }
            );
            for (const row of rows) {
                const plaintext = decrypt(row[fieldName]);
                await sequelize.query(
                    `UPDATE "${tableName}" SET "${hashField}" = :hash WHERE "${pk}" = :id`,
                    { replacements: { hash: hashForUnique(plaintext), id: row[pk] } }
                );
            }

            if (isNew) {
                try {
                    await qi.addConstraint(tableName, {
                        fields: [hashField],
                        type: 'unique',
                        name: "SequelizeUniqueConstraintError",
                    });
                } catch {}
            }
        }
    }
}

module.exports = { encrypt, decrypt, hashForUnique, syncHashColumns, initializeEncryptionKey, getKey, generateEncryptionKey, reEncryptValue, reEncryptAllModels, decryptAllModels, encryptAllModels, syncEncryptionState };
