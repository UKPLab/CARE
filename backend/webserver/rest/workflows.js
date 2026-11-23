'use strict';

/**
 * Workflows and their steps, for /rest/v1/workflows.
 *
 * REST-only: the dashboard keeps using its socket methods, which these functions mirror where noted
 * ("Mirrors …"). Called by the routes in routes/rest/.
 */

const TranslatableError = require('../../utils/TranslatableError');

const STEP_TYPES = [1, 2, 3, 4];

/**
 * Load an own workflow for a change.
 *
 * @param {Object} models the database models
 * @param {number} userId the token owner's user id
 * @param {number} id the workflow id
 * @param {Object} [transaction] the Sequelize transaction
 * @returns {Promise<Object|null>} the workflow, or null when it does not exist
 * @throws {TranslatableError} errors.rest.workflowNoAccess
 */
async function loadOwnWorkflow(models, userId, id, transaction) {
    const workflow = await models['workflow'].getById(id, {transaction});
    if (!workflow) {
        return null;
    }
    if (workflow.userId !== userId) {
        throw new TranslatableError('errors.rest.workflowNoAccess');
    }
    return workflow;
}

/**
 * Whether any study or study template is built on the workflow. Changing its steps or deleting it
 * would break those studies.
 *
 * @param {Object} models the database models
 * @param {number} workflowId the workflow id
 * @param {Object} [transaction] the Sequelize transaction
 * @returns {Promise<boolean>}
 */
async function workflowInUse(models, workflowId, transaction) {
    const count = await models['study'].count({where: {workflowId, deleted: false}, transaction});
    return count > 0;
}

/**
 * Check a step list from a request. Each step: {name, stepType 1-4, allowBackward, configuration,
 * documentFromStep}. documentFromStep is the 1-based position of an earlier step whose document this
 * step shows. Unknown keys are ignored.
 *
 * @param {*} raw the steps from the body
 * @returns {Array<Object>|null} the checked steps, or null when the shape is wrong
 */
function readSteps(raw) {
    if (!Array.isArray(raw) || raw.length === 0) {
        return null;
    }
    const steps = [];
    for (const [index, step] of raw.entries()) {
        if (!step || typeof step !== 'object' || Array.isArray(step)) {
            return null;
        }
        const configuration = step.configuration ?? {};
        const from = step.documentFromStep ?? null;
        if (typeof step.name !== 'string' || !step.name.trim() || !STEP_TYPES.includes(step.stepType)
            || (step.allowBackward !== undefined && typeof step.allowBackward !== 'boolean')
            || typeof configuration !== 'object' || Array.isArray(configuration)
            || (from !== null && (!Number.isInteger(from) || from < 1 || from > index))) {
            return null;
        }
        steps.push({
            name: step.name.trim(),
            stepType: step.stepType,
            allowBackward: step.allowBackward === true,
            configuration,
            documentFromStep: from,
        });
    }
    return steps;
}

/**
 * Create the steps of a workflow in order, linking each to the one before, then set the
 * "show the document of an earlier step" links. Same chain the dashboard import builds.
 *
 * @param {Object} models the database models
 * @param {number} workflowId the workflow id
 * @param {Array<Object>} steps the steps from readSteps
 * @param {Object} [transaction] the Sequelize transaction
 * @returns {Promise<void>}
 */
async function writeSteps(models, workflowId, steps, transaction) {
    const created = [];
    for (const step of steps) {
        created.push(await models['workflow_step'].add({
            name: step.name,
            workflowId,
            stepType: step.stepType,
            allowBackward: step.allowBackward,
            configuration: step.configuration,
            workflowStepPrevious: created.length ? created[created.length - 1].id : null,
            workflowStepDocument: null,
        }, {transaction}));
    }
    for (const [index, step] of steps.entries()) {
        if (step.documentFromStep) {
            await models['workflow_step'].updateById(created[index].id,
                {workflowStepDocument: created[step.documentFromStep - 1].id}, {transaction});
        }
    }
}

/**
 * Copy a workflow with all its steps; the caller owns the copy.
 * Mirrors WorkflowCreateModal.copy (appDataUpdate on workflow with parentWorkflowId; the workflow
 * model's afterCreate hook copies the steps).
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.sourceId the workflow to copy
 * @param {string} [data.name] the copy's name; the source's name when not given
 * @param {Object} options the REST options (models, transaction)
 * @returns {Promise<Object|null>} the copy, or null when the source does not exist
 */
async function copyWorkflow({userId, sourceId, name}, options) {
    const models = options.models;
    const source = await models['workflow'].getById(sourceId, {transaction: options.transaction});
    if (!source) {
        return null;
    }
    return models['workflow'].add({
        name: name || source.name,
        description: source.description,
        userId,
        parentWorkflowId: source.id,
        hideInFrontend: false,
    }, {transaction: options.transaction});
}

/**
 * Create workflows from the dashboard's workflow export file. Mirrors ImportFormatModal for
 * workflow and workflow_step. Differs: the file's workflowStepDocument ids point at the source
 * database (the export drops step ids), so they are ignored; documentFromStep sets the link instead.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {Array<Object>} data.items the export entries
 * @param {Object} options the REST options (models, transaction)
 * @returns {Promise<Array<Object>>} the new workflows
 * @throws {TranslatableError} errors.rest.invalidWorkflowImport
 */
async function importWorkflows({userId, items}, options) {
    const models = options.models;
    const created = [];
    for (const item of items) {
        const steps = readSteps(item.workflow_step ?? item.steps);
        if (!item || typeof item.name !== 'string' || !item.name.trim() || !steps) {
            throw new TranslatableError('errors.rest.invalidWorkflowImport');
        }
        const workflow = await models['workflow'].add({
            name: item.name.trim(),
            description: typeof item.description === 'string' ? item.description : '',
            userId,
            hideInFrontend: false,
        }, {transaction: options.transaction});
        await writeSteps(models, workflow.id, steps, options.transaction);
        created.push(workflow);
    }
    return created;
}

/**
 * Change name, description, or hideInFrontend of an own workflow. Mirrors WorkflowRenameModal.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.id the workflow id
 * @param {Object} data.fields the fields to change
 * @param {Object} options the REST options (models, transaction)
 * @returns {Promise<Object|null>} the updated workflow, or null when it does not exist
 */
async function updateWorkflow({userId, id, fields}, options) {
    const workflow = await loadOwnWorkflow(options.models, userId, id, options.transaction);
    if (!workflow) {
        return null;
    }
    return options.models['workflow'].updateById(workflow.id, fields, {transaction: options.transaction});
}

/**
 * Replace all steps of an own workflow, only while no study uses it. Mirrors the step editor in
 * WorkflowEditModal, which changes one step at a time.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.id the workflow id
 * @param {Array<Object>} data.steps the steps from readSteps
 * @param {Object} options the REST options (models, transaction)
 * @returns {Promise<Object|null>} the workflow, or null when it does not exist
 * @throws {TranslatableError} errors.rest.workflowInUse
 */
async function replaceWorkflowSteps({userId, id, steps}, options) {
    const models = options.models;
    const workflow = await loadOwnWorkflow(models, userId, id, options.transaction);
    if (!workflow) {
        return null;
    }
    if (await workflowInUse(models, workflow.id, options.transaction)) {
        throw new TranslatableError('errors.rest.workflowInUse');
    }
    const old = await models['workflow_step'].getAllByKey('workflowId', workflow.id) || [];
    for (const step of old) {
        await models['workflow_step'].deleteById(step.id, {transaction: options.transaction});
    }
    await writeSteps(models, workflow.id, steps, options.transaction);
    return workflow;
}

/**
 * Soft-delete an own workflow that no study uses. Mirrors deleteWorkflow in Workflows.vue.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.id the workflow id
 * @param {Object} options the REST options (models, transaction)
 * @returns {Promise<boolean|null>} true, or null when it does not exist
 * @throws {TranslatableError} errors.rest.workflowInUse
 */
async function deleteWorkflow({userId, id}, options) {
    const models = options.models;
    const workflow = await loadOwnWorkflow(models, userId, id, options.transaction);
    if (!workflow) {
        return null;
    }
    if (await workflowInUse(models, workflow.id, options.transaction)) {
        throw new TranslatableError('errors.rest.workflowInUse');
    }
    await models['workflow'].deleteById(workflow.id, {transaction: options.transaction});
    return true;
}

/**
 * One workflow with its steps in order. Workflows are a public table in the dashboard.
 *
 * @param {Object} data
 * @param {number} data.id the workflow id
 * @param {Object} options the REST options (models)
 * @returns {Promise<Object|null>} the workflow, or null when it does not exist
 */
async function getWorkflow({id}, options) {
    const [workflow] = await listWorkflows(options, {id});
    return workflow || null;
}

/**
 * Steps in the order their workflowStepPrevious links give, like workflow_step.getSortedWorkflowSteps.
 *
 * @param {Array<Object>} steps the workflow_step rows of one workflow
 * @returns {Array<Object>} the steps in order
 */
function sortWorkflowSteps(steps) {
    // First step per previous step, like the find() in getSortedWorkflowSteps.
    const byPrevious = new Map();
    for (const step of steps) {
        if (!byPrevious.has(step.workflowStepPrevious)) {
            byPrevious.set(step.workflowStepPrevious, step);
        }
    }
    const sorted = [];
    let current = byPrevious.get(null);
    while (current) {
        sorted.push(current);
        current = byPrevious.get(current.id);
    }
    return sorted;
}

/**
 * All workflows (or the one with `id`) with their steps in order. Workflows are a public table in
 * the dashboard too. A step's id is what stepDocuments and workflowMapping refer to.
 *
 * @param {Object} options the REST options (models)
 * @param {Object} [filter]
 * @param {number} [filter.id] only this workflow
 * @returns {Promise<Array<Object>>} the workflows
 */
async function listWorkflows(options, {id} = {}) {
    const models = options.models;
    const workflows = await models['workflow'].findAll({
        where: {deleted: false, ...(id !== undefined ? {id} : {})},
        attributes: ['id', 'name', 'description', 'userId', 'hideInFrontend', 'parentWorkflowId'],
        order: [['id', 'ASC']],
        raw: true,
    });
    // All steps in one query, then grouped per workflow.
    const steps = workflows.length === 0 ? []
        : await models['workflow_step'].getAllByKeyValues('workflowId', workflows.map((workflow) => workflow.id));
    const stepsByWorkflow = new Map(workflows.map((workflow) => [workflow.id, []]));
    for (const step of steps || []) {
        stepsByWorkflow.get(step.workflowId)?.push(step);
    }
    for (const workflow of workflows) {
        workflow.steps = sortWorkflowSteps(stepsByWorkflow.get(workflow.id)).map((step) => ({
            id: step.id,
            name: step.name,
            stepType: step.stepType,
            allowBackward: step.allowBackward,
            workflowStepDocument: step.workflowStepDocument,
        }));
    }
    return workflows;
}

module.exports = {
    copyWorkflow,
    deleteWorkflow,
    getWorkflow,
    importWorkflows,
    listWorkflows,
    readSteps,
    replaceWorkflowSteps,
    updateWorkflow,
};
