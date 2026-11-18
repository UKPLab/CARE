"use strict";

/**
 * Human-readable names for the "cannot delete, still used" messages of criterion, rubric and assessment versions.
 *
 * The messages name the referencing rows by their stored name and `versionNumber`, never by database id. The
 * entries are language neutral (`'Rubric 1' (v2)`), so the translated message only has to add its own words.
 * Names are user input: they are shortened and stripped of control characters, nothing else is trusted; the client
 * shows the message as plain text (toast, alert), and the confirm dialog escapes its own HTML.
 */

/** Entries shown before the list is cut off with `, … (+N)` */
const MAX_LISTED = 5;
const MAX_NAME_LENGTH = 60;
/** C0/C1 control characters and the Unicode line and paragraph separators */
const CONTROL_CHARACTERS = new RegExp("[\u0000-\u001f\u007f-\u009f\u2028\u2029]+", "g");

/**
 * One name for a message: control characters become spaces, whitespace is collapsed, long names are cut.
 * @param {*} value
 * @returns {string}
 */
function cleanName(value) {
    const text = String(value ?? "").replace(CONTROL_CHARACTERS, " ").replace(/\s+/g, " ").trim();
    return text.length > MAX_NAME_LENGTH ? `${text.slice(0, MAX_NAME_LENGTH - 1)}…` : text;
}

/**
 * Joins entries; more than `MAX_LISTED` are cut off with the number of omitted ones.
 * @param {string[]} entries
 * @returns {string} `-` when there is nothing to list
 */
function joinEntries(entries) {
    if (!entries.length) {
        return "-";
    }
    const shown = entries.slice(0, MAX_LISTED).join(", ");
    return entries.length > MAX_LISTED ? `${shown}, … (+${entries.length - MAX_LISTED})` : shown;
}

/**
 * `'Name' (v1)` entries for version rows. When the same name occurs in more than one group of the list, the group id
 * is added (`'Name' (v1, #7)`) so that two different entities with the same name can be told apart.
 * @param {{name: string, versionNumber: string, groupId: number}[]} rows
 * @returns {string[]}
 */
function versionEntries(rows) {
    const groupsByName = new Map();
    for (const row of rows) {
        const name = cleanName(row.name);
        groupsByName.set(name, (groupsByName.get(name) ?? new Set()).add(row.groupId));
    }
    return rows.map((row) => {
        const name = cleanName(row.name);
        const group = groupsByName.get(name).size > 1 ? `, #${row.groupId}` : "";
        return `'${name}' (v${cleanName(row.versionNumber)}${group})`;
    });
}

/**
 * Message parameters for `errors.assessment.{criterion,rubric}.inUse`: the version being deleted and the rows using it.
 * @param {{name: string, versionNumber: string}} target
 * @param {{name: string, versionNumber: string, groupId: number}[]} users rows referencing the target, in id order
 * @returns {{name: string, version: string, count: number, references: string}}
 */
function inUseParams(target, users) {
    return {
        name: cleanName(target.name),
        version: cleanName(target.versionNumber),
        count: users.length,
        references: joinEntries(versionEntries(users)),
    };
}

/** Message parameters for the rare case in which the database refused the delete and nobody was named */
function inUseUnknownParams(target) {
    return {name: cleanName(target.name), version: cleanName(target.versionNumber)};
}

/**
 * Names of the JSON references found by `findAssessmentReferences`, per holder kind.
 * Study steps read `'Study' / 'Workflow step'`; a template step reads the same with the template's name.
 * @param {import("sequelize").Sequelize} sequelize
 * @param {{studySteps: number[], templateSteps: number[], triggers: number[], triggerActions: number[], queuedRuns: number[]}} references
 * @param {import("sequelize").Transaction} transaction
 * @returns {Promise<{studySteps: string, templateSteps: string, triggers: string, triggerActions: string, queuedRuns: string}>}
 */
async function describeAssessmentReferences(sequelize, references, transaction) {
    const select = (sql, ids) => (ids.length
        ? sequelize.query(sql, {replacements: {ids}, transaction, type: sequelize.QueryTypes.SELECT})
        : Promise.resolve([]));

    const steps = (ids) => select(
        `SELECT ss.id, st.id AS "studyId", st.name AS study, ws.name AS step
         FROM study_step ss JOIN study st ON st.id = ss."studyId" LEFT JOIN workflow_step ws ON ws.id = ss."workflowStepId"
         WHERE ss.id IN (:ids) ORDER BY ss.id`, ids);
    // a study or step without a name is shown by its id, the only thing that identifies it
const label = (name, fallback) => (cleanName(name) ? `'${cleanName(name)}'` : fallback);
// an unnamed study is described by the step (the only thing that identifies it), an unnamed step by its id
const stepEntry = (kind) => (row) => (cleanName(row.study)
    ? `${label(row.study)} / ${label(row.step, `${kind} #${row.id}`)}`
    : `${kind} #${row.id}`);

    const [studySteps, templateSteps, triggers, triggerActions, queuedRuns] = await Promise.all([
        steps(references.studySteps),
        steps(references.templateSteps),
        select('SELECT id, name FROM "trigger" WHERE id IN (:ids) ORDER BY id', references.triggers),
        select("SELECT id, name FROM trigger_action WHERE id IN (:ids) ORDER BY id", references.triggerActions),
        select(
            `SELECT tq.id, t.name FROM trigger_queue tq LEFT JOIN "trigger" t ON t.id = tq."triggerId"
             WHERE tq.id IN (:ids) ORDER BY tq.id`, references.queuedRuns),
    ]);
    const named = (kind) => (rows) => joinEntries(rows.map((row) => label(row.name, `${kind} #${row.id}`)));
    return {
        studySteps: joinEntries(studySteps.map(stepEntry("Study step"))),
        templateSteps: joinEntries(templateSteps.map(stepEntry("Template step"))),
        triggers: named("Trigger")(triggers),
        triggerActions: named("Trigger action")(triggerActions),
        queuedRuns: named("Trigger run")(queuedRuns),
    };
}

module.exports = {cleanName, joinEntries, versionEntries, inUseParams, inUseUnknownParams, describeAssessmentReferences, MAX_LISTED};
