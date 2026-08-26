"use strict";

// Finds every single-column UNIQUE constraint currently on "user" (excludes
// composite/multi-column ones, which mean something different and shouldn't
// be split apart). Whatever that turns out to be — email, userName, extId,
// orcidId, samlNameId today — gets converted below, without hardcoding names.
async function getSingleColumnUniqueConstraints(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT att.attname AS column_name, con.conname
     FROM pg_constraint con
     JOIN pg_class rel ON rel.oid = con.conrelid
     JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
     WHERE rel.relname = 'user' AND con.contype = 'u' AND array_length(con.conkey, 1) = 1`,
    {transaction}
  );
  return rows;
}

// Finds the partial unique indexes this migration created (indpred IS NOT NULL
// marks a partial index), so down() can reverse them without needing to know
// their names or which columns were touched.
async function getPartialUniqueIndexes(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT irel.relname AS index_name, att.attname AS column_name
     FROM pg_index idx
     JOIN pg_class irel ON irel.oid = idx.indexrelid
     JOIN pg_class trel ON trel.oid = idx.indrelid
     JOIN pg_attribute att ON att.attrelid = trel.oid AND att.attnum = ANY(idx.indkey)
     WHERE trel.relname = 'user' AND idx.indisunique AND idx.indpred IS NOT NULL`,
    {transaction}
  );
  return rows;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const constraints = await getSingleColumnUniqueConstraints(queryInterface, transaction);

      for (const {column_name, conname} of constraints) {
        await queryInterface.sequelize.query(`ALTER TABLE "user" DROP CONSTRAINT "${conname}"`, {transaction});

        // Reuse the constraint's own name for the replacement index instead of
        // inventing a new one — it's freed up as soon as we drop the constraint.
        await queryInterface.addIndex("user", {
          fields: [column_name],
          unique: true,
          where: {deleted: false},
          name: conname,
          transaction,
        });
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const indexes = await getPartialUniqueIndexes(queryInterface, transaction);

      for (const {index_name, column_name} of indexes) {
        await queryInterface.removeIndex("user", index_name, {transaction});
        await queryInterface.addConstraint("user", {
          fields: [column_name],
          type: "unique",
          transaction,
        });
      }
    });
  },
};
