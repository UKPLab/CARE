'use strict';

/**
 * Re-encrypt all model tables that declare encryptedFields, using the new key.
 * The current key is read from backend/encryption.key.
 *
 * Usage (via Makefile):
 *   make change_encryption_key NEW_KEY=<64-char hex>
 *
 * Or directly:
 *   cd backend && NEW_KEY=<hex> node scripts/changeEncryptionKey.js
 *
 * On success the new key is written to backend/encryption.key.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { getKey, generateEncryptionKey, reEncryptAllModels } = require('../utils/helper/encryption');
const db = require('../db');

const KEY_FILE = path.resolve(__dirname, '../encryption.key');

function prompt(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

async function main() {
    let newKeyHex = process.env.NEW_KEY;

    if (!newKeyHex) {
        const answer = await prompt('No NEW_KEY provided. Generate a new key automatically? [y/N] ');
        if (answer.toLowerCase() !== 'y') {
            console.log('Aborted.');
            process.exit(0);
        }
        newKeyHex = generateEncryptionKey();
        console.log(`Generated new key: ${newKeyHex}`);
        console.log('Store this somewhere safe — it cannot be recovered after rotation.');
    }

    if (db?.sequelize?.options) db.sequelize.options.logging = false;

    const oldKey = getKey();
    const newKey = Buffer.from(newKeyHex, 'hex');

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

    fs.writeFileSync(KEY_FILE, newKeyHex, { encoding: 'utf8', mode: 0o600 });
    console.log('encryption.key updated with new key.');

    if (db.sequelize?.close) await db.sequelize.close();
}

main().catch((err) => {
    console.error(`ERROR${err.model ? ` in model "${err.model}"` : ''}: ${err.message || err}`);
    process.exit(1);
});
