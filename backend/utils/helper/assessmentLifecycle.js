"use strict";

const TranslatableError = require("../TranslatableError");
// used as a module object so tests can pause the reference check while the row lock is held
const assessmentReferences = require("./assessmentReferences.js");
const {lockVersionGroup, latestLiveVersionId} = require("./assessmentVersions.js");
const {describeAssessmentReferences, cleanName} = require("./assessmentReferenceLabels.js");

/**
 * Soft-deletes one assessment version, in the caller's transaction (used by the `assessmentDelete` socket event).
 *
 * Steps, in this order (the order is the concurrency protocol):
 *  1. the group lock, which serialises creators and deleters of the group (the database triggers take it too);
 *  2. the version row `FOR UPDATE`: waits for writers of references, which hold `FOR KEY SHARE` on it until they
 *     commit (database trigger `assessment_reference_guard`), and makes later writers wait for this transaction;
 *  3. the JSON reference check (study steps, templates, triggers, queued runs): a referenced version is refused;
 *  4. `deleted = true`. The database does the rest in the same statement and transaction: it flags the
 *     `assessment_rubric` rows as deleted (never removes them) and re-links the live successor to this
 *     version's predecessor (`V1 <- V2 <- V3` becomes `V1 <- V3` when V2 is deleted). The deleted version keeps its
 *     own predecessor link as history. Only lifecycle columns change, never content.
 *
 * @param {import("sequelize").Sequelize} sequelize
 * @param {number} assessmentId
 * @param {import("sequelize").Transaction} transaction
 * @returns {Promise<{id: number, assessmentGroupId: number, latestVersionId: number|null}>} the deleted version and
 *   the id of the latest remaining version of its group (null when none is left)
 * @throws {TranslatableError} notFound, or inUse naming the referencing rows
 */
async function softDeleteAssessmentVersion(sequelize, assessmentId, transaction) {
    const {assessment} = sequelize.models;
    const notFound = () => new TranslatableError("errors.assessment.assessment.notFound");

    const found = await assessment.findOne({where: {id: assessmentId, deleted: false}, transaction});
    if (!found) {
        throw notFound();
    }
    await lockVersionGroup(sequelize, "assessment", found.assessmentGroupId, transaction);
    const row = await assessment.findOne({where: {id: assessmentId, deleted: false}, transaction, lock: transaction.LOCK.UPDATE});
    if (!row) {
        throw notFound();
    }

    const references = await assessmentReferences.findAssessmentReferences(sequelize, assessmentId, transaction);
    const count = assessmentReferences.countReferences(references);
    if (count) {
        throw new TranslatableError("errors.assessment.assessment.inUse", {
            name: cleanName(row.name),
            version: cleanName(row.versionNumber),
            count,
            ...(await describeAssessmentReferences(sequelize, references, transaction)),
        });
    }

    await assessment.update({deleted: true, deletedAt: new Date()}, {where: {id: assessmentId}, transaction});
    const latestVersionId = await latestLiveVersionId(sequelize, "assessment", row.assessmentGroupId, transaction);
    return {id: row.id, assessmentGroupId: row.assessmentGroupId, latestVersionId};
}

module.exports = {softDeleteAssessmentVersion};
