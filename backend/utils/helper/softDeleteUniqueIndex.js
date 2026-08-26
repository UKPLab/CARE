/**
 * Helpers for converting a table's plain UNIQUE constraints into partial unique
 * indexes scoped to non-deleted rows (`WHERE deleted = false`), so a soft-deleted
 * row's unique value (e.g. email, userName) can be reused by a new active row.
 *
 * Used by migration 20260729144702-partial-unique-user-columns.js.
 */

/**
 * Finds every single-column UNIQUE constraint currently on the given table
 * (excludes composite/multi-column ones, which mean something different and
 * shouldn't be split apart).
 *
 * @param {import("sequelize").QueryInterface} queryInterface
 * @param {string} table - table name
 * @param {import("sequelize").Transaction} transaction
 * @returns {Promise<Array<{column_name: string, conname: string}>>}
 */
exports.getSingleColumnUniqueConstraints = async function getSingleColumnUniqueConstraints(queryInterface, table, transaction) {
    const [rows] = await queryInterface.sequelize.query(
        `SELECT att.attname AS column_name, con.conname
         FROM pg_constraint con
         JOIN pg_class rel ON rel.oid = con.conrelid
         JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
         WHERE rel.relname = :table AND con.contype = 'u' AND array_length(con.conkey, 1) = 1`,
        {replacements: {table}, transaction}
    );
    return rows;
}

/**
 * Finds the partial unique indexes previously created by addPartialUniqueIndexes
 * on the given table (indpred IS NOT NULL marks a partial index), so a rollback
 * can reverse them without needing to know their names or which columns were
 * touched.
 *
 * @param {import("sequelize").QueryInterface} queryInterface
 * @param {string} table - table name
 * @param {import("sequelize").Transaction} transaction
 * @returns {Promise<Array<{index_name: string, column_name: string}>>}
 */
exports.getPartialUniqueIndexes = async function getPartialUniqueIndexes(queryInterface, table, transaction) {
    const [rows] = await queryInterface.sequelize.query(
        `SELECT irel.relname AS index_name, att.attname AS column_name
         FROM pg_index idx
         JOIN pg_class irel ON irel.oid = idx.indexrelid
         JOIN pg_class trel ON trel.oid = idx.indrelid
         JOIN pg_attribute att ON att.attrelid = trel.oid AND att.attnum = ANY(idx.indkey)
         WHERE trel.relname = :table AND idx.indisunique AND idx.indpred IS NOT NULL`,
        {replacements: {table}, transaction}
    );
    return rows;
}

/**
 * Converts every single-column UNIQUE constraint on the given table into a
 * partial unique index scoped to `WHERE deleted = false`, reusing each
 * constraint's own name for its replacement index.
 *
 * @param {import("sequelize").QueryInterface} queryInterface
 * @param {string} table - table name
 * @param {import("sequelize").Transaction} transaction
 * @returns {Promise<void>}
 */
exports.addPartialUniqueIndexes = async function addPartialUniqueIndexes(queryInterface, table, transaction) {
    const constraints = await exports.getSingleColumnUniqueConstraints(queryInterface, table, transaction);

    for (const {column_name, conname} of constraints) {
        await queryInterface.sequelize.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${conname}"`, {transaction});

        // Reuse the constraint's own name for the replacement index instead of
        // inventing a new one — it's freed up as soon as we drop the constraint.
        await queryInterface.addIndex(table, {
            fields: [column_name],
            unique: true,
            where: {deleted: false},
            name: conname,
            transaction,
        });
    }
}

/**
 * Reverses addPartialUniqueIndexes: drops the partial unique indexes on the
 * given table and restores plain UNIQUE constraints in their place.
 *
 * @param {import("sequelize").QueryInterface} queryInterface
 * @param {string} table - table name
 * @param {import("sequelize").Transaction} transaction
 * @returns {Promise<void>}
 */
exports.removePartialUniqueIndexes = async function removePartialUniqueIndexes(queryInterface, table, transaction) {
    const indexes = await exports.getPartialUniqueIndexes(queryInterface, table, transaction);

    for (const {index_name, column_name} of indexes) {
        await queryInterface.removeIndex(table, index_name, {transaction});
        await queryInterface.addConstraint(table, {
            fields: [column_name],
            type: "unique",
            transaction,
        });
    }
}
