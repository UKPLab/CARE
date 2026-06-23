'use strict';

/**
 * Bulk encrypt or decrypt all encryptedFields across all models.
 * Used by the backup targets to produce a plaintext dump, then restore encryption.
 *
 * Usage:
 *   ENCRYPTION_MODE=decrypt node scripts/toggleEncryption.js
 *   ENCRYPTION_MODE=encrypt node scripts/toggleEncryption.js
 */

const { decryptAllModels, encryptAllModels } = require('../utils/encryption');
const db = require('../db');

async function main() {
    const mode = process.env.ENCRYPTION_MODE;
    if (mode !== 'encrypt' && mode !== 'decrypt') {
        console.error('ERROR: ENCRYPTION_MODE must be "encrypt" or "decrypt".');
        process.exit(1);
    }

    if (db?.sequelize?.options) db.sequelize.options.logging = false;

    if (mode === 'decrypt') {
        console.log('[encryption] Decrypting all fields...');
        const results = await decryptAllModels(db);
        for (const { model, total, updated } of results) {
            console.log(`  [${model}] decrypted ${updated}/${total} row(s)`);
        }
    } else {
        console.log('[encryption] Encrypting all fields...');
        const results = await encryptAllModels(db);
        for (const { model, total, updated } of results) {
            console.log(`  [${model}] encrypted ${updated}/${total} row(s)`);
        }
    }

    if (db.sequelize?.close) await db.sequelize.close();
}

main().catch((err) => {
    console.error(`ERROR${err.model ? ` in model "${err.model}"` : ''}: ${err.message || err}`);
    process.exit(1);
});
