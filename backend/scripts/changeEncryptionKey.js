'use strict';

/**
 * Re-encrypt all model tables that declare encryptedFields, using the new key.
 * The current key is read from backend/encryption.key.
 *
 * Usage (via Makefile):
 *   make rotate-key NEW_KEY=<64-char hex>
 *
 * Or directly:
 *   cd backend && NEW_KEY=<hex> node scripts/rotateEncryptionKey.js
 *
 * On success the new key is written to backend/encryption.key.
 */

const fs = require('fs');
const path = require('path');
const { getKey, reEncryptAllModels } = require('../utils/encryption');
const db = require('../db');

const KEY_FILE = path.resolve(__dirname, '../encryption.key');

async function main() {
    if (!process.env.NEW_KEY) {
        console.error('ERROR: NEW_KEY is not set.');
        process.exit(1);
    }

    if (db?.sequelize?.options) db.sequelize.options.logging = false;

    const oldKey = getKey(); // reads and validates backend/encryption.key
    const newKey = Buffer.from(process.env.NEW_KEY, 'hex');

    if (newKey.length !== 32) {
        console.error(`ERROR: NEW_KEY must be a 64-character hex string (32 bytes, got ${newKey.length}).`);
        process.exit(1);
    }

    if (oldKey.equals(newKey)) {
        console.log('NEW_KEY is identical to the current key — nothing to do.');
        process.exit(0);
    }

    console.log('Rotating encryption key across all model tables…');
    const results = await reEncryptAllModels(db, newKey);

    for (const { model, total, updated } of results) {
        console.log(`  [${model}] re-encrypted ${updated}/${total} row(s)`);
    }

    fs.writeFileSync(KEY_FILE, process.env.NEW_KEY, { encoding: 'utf8', mode: 0o600 });
    console.log('encryption.key updated with new key.');

    if (db.sequelize?.close) await db.sequelize.close();
}

main().catch((err) => {
    console.error(`ERROR${err.model ? ` in model "${err.model}"` : ''}: ${err.message || err}`);
    process.exit(1);
});
