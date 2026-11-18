"use strict";

const TranslatableError = require("../TranslatableError");
const {QUEUE_STATUS} = require("../triggerQueueStatus.js");

/**
 * References to an `assessment` version that the database cannot see because they live in JSON.
 *
 * Shapes recognised anywhere inside the JSON (any depth), as a number or a numeric string:
 *   1. `{"assessmentId": <id>}`  e.g. `study_step.configuration.settings.assessmentId`, and AI hook
 *      inputs `{"type": "assessment", "assessmentId": <id>}`
 *   2. `{"table": "assessment", "fileIds": [<id>, ...]}`  trigger / skill input mappings
 *
 * Holders checked:
 *   - `study_step.configuration`: steps of studies and of study templates (`study.template`);
 *     soft-deleted steps and studies count, because results and exports still use them
 *   - `trigger.configuration` and `trigger_action.configuration`: rows that are not soft-deleted
 *   - `trigger_queue.configuration`: runs that are still pending or running
 *
 * NOT checked, on purpose:
 *   - legacy `configurationId` (top-level or under `settings`): it is an id of the `configuration`
 *     table, a different id space, and must never be compared with an assessment id
 *   - `workflow_step.configuration`: it only describes the picker, it holds no row id
 *   - `document_data`: results store criterion association ids, not assessment ids
 *
 * Writer side: the database guards every holder (migration 20261116120000-add-assessment-reference-guard.js). A
 * BEFORE INSERT / UPDATE trigger on study_step, trigger, trigger_action and trigger_queue reads the assessment ids out
 * of the saved configuration (same two shapes as above) and takes `SELECT ... FOR KEY SHARE` on each live assessment
 * version in ascending id order; a missing or soft-deleted version raises foreign_key_violation (23503). The delete takes the opposite
 * lock (`FOR UPDATE`) before it looks, so exactly one of the two wins, for every code path that writes such JSON
 * (generic table updates, template copies, bulk inserts). Only ids that are new for the row are checked.
 * Stage 4 handlers that save assessment ids should still map that error to a message (`lockAssessmentForReference`
 * below does the same check in application code and throws `errors.assessment.assessment.notFound`).
 *
 * Consumers today: nothing writes `assessmentId` yet (Stage 4 will); the guard and the check are generic so that the
 * first writer is protected from its first save.
 */

/** jsonpath for shape 1 and shape 2; `$id` is the id as a number, `$sid` as a string */
const MATCH_PATHS = [
    "$.** ? (@.assessmentId == $id || @.assessmentId == $sid)",
    "$.** ? (@.table == \"assessment\" && exists(@.fileIds[*] ? (@ == $id || @ == $sid)))",
];

/** SQL condition: the JSON column contains a reference to the assessment (bound to :vars) */
const matches = (column) => `(${MATCH_PATHS
    .map((path) => `jsonb_path_exists(${column}, '${path}', CAST(:vars AS jsonb))`)
    .join(" OR ")})`;

/**
 * Every reference to an assessment version, by holder.
 * Run it inside the deleting transaction after the assessment row is locked (see `assessmentDelete`).
 * @param {import("sequelize").Sequelize} sequelize
 * @param {number} assessmentId
 * @param {import("sequelize").Transaction} transaction
 * @returns {Promise<{studySteps: number[], templateSteps: number[], triggers: number[], triggerActions: number[], queuedRuns: number[]}>}
 *   ids of the referencing rows, ascending
 */
async function findAssessmentReferences(sequelize, assessmentId, transaction) {
    const replacements = {vars: JSON.stringify({id: Number(assessmentId), sid: String(assessmentId)})};
    const run = (sql, extra = {}) => sequelize.query(sql, {
        replacements: {...replacements, ...extra}, transaction, type: sequelize.QueryTypes.SELECT,
    });

    const steps = await run(
        `SELECT ss.id, st.template FROM study_step ss JOIN study st ON st.id = ss."studyId"
         WHERE ${matches('ss."configuration"')} ORDER BY ss.id`);
    const triggers = await run(
        `SELECT id FROM "trigger" WHERE deleted = false AND ${matches('"configuration"')} ORDER BY id`);
    const triggerActions = await run(
        `SELECT id FROM trigger_action WHERE deleted = false AND ${matches('"configuration"')} ORDER BY id`);
    const queuedRuns = await run(
        `SELECT id FROM trigger_queue WHERE deleted = false AND status IN (:active) AND ${matches('"configuration"')} ORDER BY id`,
        {active: [QUEUE_STATUS.PENDING, QUEUE_STATUS.RUNNING]});

    return {
        studySteps: steps.filter((row) => !row.template).map((row) => row.id),
        templateSteps: steps.filter((row) => row.template).map((row) => row.id),
        triggers: triggers.map((row) => row.id),
        triggerActions: triggerActions.map((row) => row.id),
        queuedRuns: queuedRuns.map((row) => row.id),
    };
}

/** @returns {number} total number of referencing rows */
const countReferences = (references) => Object.values(references).reduce((sum, ids) => sum + ids.length, 0);

/**
 * Application-side form of the lock the database guard takes: `SELECT ... FOR KEY SHARE` on the assessment row. Blocks while a
 * delete holds the row (and the delete waits for writers that hold it), and fails when the row is gone,
 * so a reference to a deleted assessment cannot be saved. Call it before writing the id, in the same
 * transaction, under READ COMMITTED (the Sequelize default). A soft-deleted version counts as gone: the waiting
 * writer re-reads the row after the delete commits and no longer finds it. Optional for writers: the database guard enforces it anyway.
 * @param {import("sequelize").Sequelize} sequelize
 * @param {number|string} assessmentId
 * @param {import("sequelize").Transaction} transaction
 * @throws {TranslatableError} errors.assessment.assessment.notFound when the version does not exist (any more)
 */
async function lockAssessmentForReference(sequelize, assessmentId, transaction) {
    const rows = await sequelize.query(
        'SELECT id FROM assessment WHERE id = :id AND "deleted" = false FOR KEY SHARE',
        {replacements: {id: Number(assessmentId)}, transaction, type: sequelize.QueryTypes.SELECT});
    if (!rows.length) {
        throw new TranslatableError("errors.assessment.assessment.notFound");
    }
}

/**
 * Assessment ids a JSON value references, using the same two shapes as `findAssessmentReferences`.
 * Lets a writer lock exactly what it is about to save.
 * @param {*} json
 * @returns {number[]} distinct positive integer ids
 */
function collectAssessmentIds(json) {
    const ids = new Set();
    const toId = (value) => {
        // a number, or a string in canonical form ("007" is not 7: the jsonpath of the check compares strings as they are)
        const id = typeof value === "number" || (typeof value === "string" && /^[1-9][0-9]{0,15}$/.test(value)) ? Number(value) : NaN;
        return Number.isSafeInteger(id) && id > 0 ? id : null;
    };
    const visit = (node) => {
        if (Array.isArray(node)) {
            node.forEach(visit);
        } else if (node !== null && typeof node === "object") {
            // lax jsonpath compares the elements of an array too, so {"assessmentId": [1, 2]} references both
            for (const value of Array.isArray(node.assessmentId) ? node.assessmentId : [node.assessmentId]) {
                const direct = toId(value);
                if (direct) {
                    ids.add(direct);
                }
            }
            if (node.table === "assessment" && Array.isArray(node.fileIds)) {
                node.fileIds.map(toId).filter(Boolean).forEach((id) => ids.add(id));
            }
            Object.values(node).forEach(visit);
        }
    };
    visit(json);
    return [...ids];
}

module.exports = {findAssessmentReferences, countReferences, lockAssessmentForReference, collectAssessmentIds};
