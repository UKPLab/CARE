/**
 * CLI: list visible submission copies so an operator can review them. Read-only.
 *
 * Session copies made before the hideInFrontend column existed look the same as group copies and stay
 * assignable. This lists what is known about each visible copy and decides nothing: sessionLikeAncestry
 * is also true for valid group copies, so it cannot be used to hide rows automatically.
 *
 * Usage:
 *   make audit-submission-copies > copies.csv
 */

'use strict';

const CSV_COLUMNS = [
    "copyId", "parentSubmissionId", "userId", "createdByUserId", "createdAt", "group",
    "studyIds", "parentStudyIds", "sessionLikeAncestry",
];

const VISIBLE_COPIES = `
    SELECT copy."id" AS "copyId",
           copy."parentSubmissionId",
           copy."userId",
           copy."createdByUserId",
           copy."createdAt",
           copy."group",
           COALESCE(array_agg(DISTINCT study."id") FILTER (WHERE study."id" IS NOT NULL), '{}') AS "studyIds",
           COALESCE(array_agg(DISTINCT study."parentStudyId") FILTER (WHERE study."parentStudyId" IS NOT NULL), '{}')
               AS "parentStudyIds",
           COUNT(parent_step."id") > 0 AS "sessionLikeAncestry"
    FROM "submission" AS copy
    LEFT JOIN "document" AS copy_document ON copy_document."submissionId" = copy."id"
    LEFT JOIN "study_step" AS step ON step."documentId" = copy_document."id"
    LEFT JOIN "study" AS study ON study."id" = step."studyId"
    LEFT JOIN "study_step" AS parent_step
           ON parent_step."studyId" = study."parentStudyId"
          AND parent_step."documentId" = copy_document."parentDocumentId"
    WHERE copy."parentSubmissionId" IS NOT NULL
      AND copy."hideInFrontend" = false
      AND copy."deleted" = false
    GROUP BY copy."id"
    ORDER BY copy."id"`;

/**
 * Run work in a transaction the database itself refuses to write in.
 * Sequelize's readOnly transaction option does not do this: it only picks a replication pool.
 * @template T
 * @param {import("sequelize").Sequelize} sequelize connection
 * @param {function(import("sequelize").Transaction): Promise<T>} work runs inside the transaction
 * @returns {Promise<T>}
 */
function readOnlyTransaction(sequelize, work) {
    return sequelize.transaction(async (transaction) => {
        await sequelize.query("SET TRANSACTION READ ONLY", {transaction});
        return work(transaction);
    });
}

/**
 * List the visible copies.
 * @param {import("sequelize").Sequelize} sequelize connection
 * @returns {Promise<Array<Object>>} one row per copy
 */
function auditSubmissionCopies(sequelize) {
    return readOnlyTransaction(sequelize, (transaction) => sequelize.query(VISIBLE_COPIES, {
        type: sequelize.QueryTypes.SELECT,
        transaction,
    }));
}

/**
 * Format audit rows as CSV.
 * @param {Array<Object>} rows audit rows
 * @returns {string}
 */
function toCsv(rows) {
    const cell = (value) => {
        if (value === null || value === undefined) return "";
        if (value instanceof Date) return value.toISOString();
        return Array.isArray(value) ? `"${value.join(" ")}"` : String(value);
    };
    return [CSV_COLUMNS.join(","), ...rows.map((row) => CSV_COLUMNS.map((key) => cell(row[key])).join(","))].join("\n");
}

if (require.main === module) {
    const db = require("../db");
    auditSubmissionCopies(db.sequelize)
        .then((rows) => {
            console.log(toCsv(rows));
            console.error(`${rows.length} visible submission copies. Nothing was changed.`);
        })
        .catch((err) => {
            console.error(err);
            process.exitCode = 1;
        })
        .finally(() => db.sequelize.close());
}

module.exports = {auditSubmissionCopies, readOnlyTransaction, toCsv};
