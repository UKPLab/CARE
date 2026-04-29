/**
 * CLI: produce a consent-filtered, pseudonymized copy of the database in-place.
 * Run against a sidecar DB (never against production).
 *
 * @author Dennis Zyska
 *
 * Usage:
 *   node scripts/anonymize.js [--seed <int>] [--num <int>]
 *
 * Environment:
 *   POSTGRES_CAREDB  — name of the sidecar database
 *   POSTGRES_HOST / POSTGRES_PORT / NODE_ENV
 *
 * Phase A   — delete non-consenting users + their per-user data; reassign
 *             owned resources to the admin user.
 * Phase A.2 — schema-introspection safety net for any userId-like columns
 *             not covered by Sequelize associations.
 * Phase B   — pseudonymize surviving users with @faker-js/faker.
 * Phase C   — wipe auth secrets on all surviving users.
 */

'use strict';

const db = require('../db');
const { faker } = require('@faker-js/faker');

// Models where non-consenting user rows are DELETED outright.
const DELETE_MODELS = [
    'statistic',
    'user_setting',
    'user_environment',
    'log',
    'comment_state',
    'comment_vote',
    'user_role_matching',
    'study_session',
];

// Models where the userId column is REASSIGNED to the admin user instead of
// deleting the row (shared resources that consenting users may depend on).
const REASSIGN_MODELS = [
    'project',
    'template',
    'submission',
    'configuration',
    'tag',
    'tag_set',
    'document',
    'study',
];

// Auth secret columns always wiped on surviving users (Phase C).
const AUTH_SECRET_COLUMNS = [
    'passwordHash',
    'salt',
    'initialPassword',
    'resetToken',
    'tokenVerification',
];

/**
 * Parse CLI arguments into an options object.
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {{ seed: number|null, num: number|null }}
 */
function parseArgs(argv) {
    const result = { seed: null, num: null };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--seed' && argv[i + 1] !== undefined) {
            result.seed = parseInt(argv[++i], 10);
        } else if (argv[i] === '--num' && argv[i + 1] !== undefined) {
            result.num = parseInt(argv[++i], 10);
        }
    }
    return result;
}

/**
 * Shuffle an array in-place using Fisher-Yates via faker's RNG so the result
 * is deterministic when a seed is set.
 * @param {any[]} arr - Array to shuffle
 * @returns {any[]} New shuffled array
 */
function shuffleArray(arr) {
    // Fisher-Yates — uses faker's rng so it respects the seed
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(faker.number.float() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Remove data belonging to the given user IDs using the two-track policy:
 * - DELETE_MODELS: rows are hard-deleted.
 * - REASSIGN_MODELS: userId is reassigned to the admin user so shared
 *   resources (projects, studies, etc.) are not lost.
 * @param {number[]} userIds - IDs of users whose data should be removed
 * @param {number} adminId - ID of the admin user to receive reassigned rows
 * @returns {Promise<void>}
 */
async function removeUserData(userIds, adminId) {
    if (userIds.length === 0) return;

    for (const modelName of DELETE_MODELS) {
        const Model = db.models[modelName];
        if (!Model) { console.warn(`[WARN] Model not found: ${modelName}`); continue; }
        const col = Object.keys(Model.getAttributes()).find(k => k.toLowerCase() === 'userid');
        if (!col) continue;
        const count = await Model.destroy({ where: { [col]: userIds }, force: true });
        if (count > 0) console.log(`  deleted ${count} rows from ${modelName}`);
    }

    for (const modelName of REASSIGN_MODELS) {
        const Model = db.models[modelName];
        if (!Model) { console.warn(`[WARN] Model not found: ${modelName}`); continue; }
        const col = Object.keys(Model.getAttributes()).find(k => k.toLowerCase() === 'userid');
        if (!col) continue;
        const [count] = await Model.update({ [col]: adminId }, { where: { [col]: userIds } });
        if (count > 0) console.log(`  reassigned ${count} rows in ${modelName} → admin`);
    }
}

/**
 * Defense-in-depth safety net: query information_schema for any table not
 * already handled by removeUserData that still has a "userId" column, and
 * hard-delete matching rows. Logs a warning for each hit so developers know
 * to add the missing Sequelize association.
 * @param {number[]} userIds - IDs of the users that were removed
 * @returns {Promise<void>}
 */
async function introspectionSafetyNet(userIds) {
    if (userIds.length === 0) return;

    const handledTables = new Set([
        ...DELETE_MODELS.map(m => db.models[m]?.getTableName()).filter(Boolean),
        ...REASSIGN_MODELS.map(m => db.models[m]?.getTableName()).filter(Boolean),
        db.models['user']?.getTableName(),
    ]);

    const [rows] = await db.sequelize.query(
        `SELECT table_name, column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name NOT IN (:handled)`,
        { replacements: { handled: [...handledTables] } }
    );

    const userCols = rows.filter(r => r.column_name === 'userId');

    for (const { table_name, column_name } of userCols) {
        const [deleted] = await db.sequelize.query(
            `DELETE FROM "${table_name}" WHERE "${column_name}" = ANY(:ids) RETURNING 1`,
            { replacements: { ids: userIds } }
        );
        if (deleted.length > 0) {
            console.warn(
                `[WARN] Safety net deleted ${deleted.length} rows from ` +
                `"${table_name}".${column_name} — add a Sequelize association to silence this warning.`
            );
        }
    }
}

/**
 * Phase B+C: replace PII columns on all surviving users with faker-generated
 * values (driven by User.accessMap so future PII additions are picked up
 * automatically), and null out all auth secret columns.
 * @returns {Promise<void>}
 */
async function pseudonymizeAndWipeSecrets() {
    const User = db.models['user'];
    const piiColumns = User.accessMap.flatMap(entry => entry.columns);

    const users = await User.findAll({ paranoid: false });
    console.log(`\nPhase B+C: pseudonymizing ${users.length} surviving users…`);

    for (const user of users) {
        const firstName = faker.person.firstName();
        const lastName  = faker.person.lastName();
        const email     = faker.internet.email({ firstName, lastName });

        const updates = { firstName, lastName, email };

        for (const col of piiColumns) {
            if (col !== 'firstName' && col !== 'lastName' && col !== 'email') {
                updates[col] = null;
            }
        }

        for (const col of AUTH_SECRET_COLUMNS) {
            if (col in User.getAttributes()) updates[col] = null;
        }

        await user.update(updates, { hooks: false });
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (db?.sequelize?.options) db.sequelize.options.logging = false;
    if (args.seed !== null) {
        faker.seed(args.seed);
        console.log(`Faker seed: ${args.seed}`);
    }

    const User = db.models['user'];

    // Find admin user (first user with the 'admin' role)
    const adminRole = await db.models['user_role'].findOne({ where: { name: 'admin' } });
    if (!adminRole) { console.error('ERROR: admin role not found'); process.exit(1); }

    const adminMatching = await db.models['user_role_matching'].findOne({
        where: { userRoleId: adminRole.id },
    });
    if (!adminMatching) { console.error('ERROR: no admin user found'); process.exit(1); }
    const adminId = adminMatching.userId;
    console.log(`Admin user id: ${adminId}`);

    // Phase A: remove non-consenters
    const nonConsenters = await User.findAll({
        where: { acceptDataSharing: false },
        attributes: ['id'],
        paranoid: false,
    });
    const nonConsentIds = nonConsenters.map(u => u.id);
    console.log(`\nPhase A: ${nonConsentIds.length} non-consenting users to remove…`);
    await removeUserData(nonConsentIds, adminId);
    if (nonConsentIds.length > 0) {
        await User.destroy({ where: { id: nonConsentIds }, force: true });
        console.log(`  deleted ${nonConsentIds.length} user rows`);
    }

    // Phase A.2: introspection safety net
    console.log('\nPhase A.2: schema introspection safety net…');
    await introspectionSafetyNet(nonConsentIds);

    // Optional --num subset reduction
    if (args.num !== null) {
        const survivors = await User.findAll({ attributes: ['id'], paranoid: false });
        if (survivors.length > args.num) {
            const shuffled = shuffleArray(survivors.map(u => u.id));
            const toRemove = shuffled.slice(args.num);
            console.log(`\nPhase A (subset): reducing to ${args.num} users, removing ${toRemove.length}…`);
            await removeUserData(toRemove, adminId);
            await User.destroy({ where: { id: toRemove }, force: true });
            await introspectionSafetyNet(toRemove);
        } else {
            console.log(`\n--num ${args.num}: already ≤ ${args.num} consenting users, no subset needed.`);
        }
    }

    // Phase B + C: pseudonymize survivors + wipe auth secrets
    await pseudonymizeAndWipeSecrets();

    console.log('\nAnonymization complete.');
    if (db.sequelize?.close) await db.sequelize.close();
}

main().catch(err => {
    console.error('ERROR:', err);
    process.exit(1);
});
