"use strict";

// Columns that currently have a table-wide UNIQUE constraint but should only
// be unique among non-deleted users, so a soft-deleted user's email/username
// etc. can be reused by a new signup.
const columns = ["email", "userName", "extId", "orcidId", "samlNameId"];

function indexName(column) {
  return `user_${column}_not_deleted_unique`;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const column of columns) {
        const [constraints] = await queryInterface.sequelize.query(
          `SELECT con.conname
           FROM pg_constraint con
           JOIN pg_class rel ON rel.oid = con.conrelid
           JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
           WHERE rel.relname = 'user' AND att.attname = :column AND con.contype = 'u'`,
          {replacements: {column}, transaction}
        );

        for (const {conname} of constraints) {
          await queryInterface.sequelize.query(`ALTER TABLE "user" DROP CONSTRAINT "${conname}"`, {transaction});
        }

        await queryInterface.addIndex("user", {
          fields: [column],
          unique: true,
          where: {deleted: false},
          name: indexName(column),
          transaction,
        });
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const column of columns) {
        await queryInterface.removeIndex("user", indexName(column), {transaction});
        await queryInterface.addConstraint("user", {
          fields: [column],
          type: "unique",
          transaction,
        });
      }
    });
  },
};
