'use strict';

const AI_CHAT_SERVICE = {
    name: "aiChat",
    type: "aiChat",
    required: true,
    outputMapping: false,
};

const WORKFLOW_VARIANTS = [
    {
        sourceName: "Peer Review Workflow",
        name: "Peer Review Workflow (AI Chat)",
    },
    {
        sourceName: "Peer Review Workflow (Assessment)",
        name: "Peer Review Workflow (Assessment, AI Chat)",
    },
    {
        sourceName: "Peer Review Workflow (Assessment with AI)",
        name: "Peer Review Workflow (AI Assessment, AI Chat)",
    },
    {
        sourceName: "Review Assessment Workflow",
        name: "Review Assessment Workflow (AI Chat)",
    },
    {
        sourceName: "Revision Workflow",
        name: "Revision Workflow (AI Chat)",
    },
];

/**
 * Add the required AI Chat service without changing the source configuration.
 *
 * @param {Object|null} sourceConfiguration - Original workflow-step configuration
 * @returns {Object} Extended workflow-step configuration
 */
function addAIChatService(sourceConfiguration) {
    const configuration = JSON.parse(JSON.stringify(sourceConfiguration || {}));
    const services = Array.isArray(configuration.services) ? configuration.services : [];
    configuration.services = [...services, AI_CHAT_SERVICE];
    return configuration;
}

/**
 * Clone one workflow and reconnect references between its copied steps.
 *
 * @param {Object} queryInterface - Sequelize migration query interface
 * @param {Object} Sequelize - Sequelize library
 * @param {Object} variant - Source and target workflow names
 * @param {Object} transaction - Sequelize transaction
 * @returns {Promise<void>}
 */
async function cloneWorkflow(queryInterface, Sequelize, variant, transaction) {
    const [existingWorkflow] = await queryInterface.sequelize.query(
        `SELECT id FROM workflow WHERE name = :name AND deleted = false LIMIT 1`,
        {
            replacements: {name: variant.name},
            type: Sequelize.QueryTypes.SELECT,
            transaction,
        },
    );
    if (existingWorkflow) {
        return;
    }

    const [sourceWorkflow] = await queryInterface.sequelize.query(
        `SELECT id, description, "parentWorkflowId", "hideInFrontend", "userId"
         FROM workflow
         WHERE name = :name AND deleted = false
         ORDER BY id
         LIMIT 1`,
        {
            replacements: {name: variant.sourceName},
            type: Sequelize.QueryTypes.SELECT,
            transaction,
        },
    );
    if (!sourceWorkflow) {
        throw new Error(`Workflow not found: ${variant.sourceName}`);
    }

    const sourceSteps = await queryInterface.sequelize.query(
        `SELECT id, name, "stepType", "workflowStepPrevious", "allowBackward",
                "workflowStepDocument", configuration
         FROM workflow_step
         WHERE "workflowId" = :workflowId AND deleted = false
         ORDER BY id`,
        {
            replacements: {workflowId: sourceWorkflow.id},
            type: Sequelize.QueryTypes.SELECT,
            transaction,
        },
    );
    if (!sourceSteps.length) {
        throw new Error(`Workflow has no steps: ${variant.sourceName}`);
    }

    const now = new Date();
    const [insertedWorkflow] = await queryInterface.bulkInsert("workflow", [{
        name: variant.name,
        description: `${sourceWorkflow.description || variant.sourceName} Includes AI Chat.`,
        parentWorkflowId: sourceWorkflow.parentWorkflowId,
        hideInFrontend: sourceWorkflow.hideInFrontend,
        userId: sourceWorkflow.userId,
        createdAt: now,
        updatedAt: now,
    }], {returning: true, transaction});

    const stepIdMap = new Map();
    for (const sourceStep of sourceSteps) {
        const [insertedStep] = await queryInterface.bulkInsert("workflow_step", [{
            name: sourceStep.name,
            workflowId: insertedWorkflow.id,
            stepType: sourceStep.stepType,
            workflowStepPrevious: null,
            allowBackward: sourceStep.allowBackward,
            workflowStepDocument: null,
            configuration: JSON.stringify(addAIChatService(sourceStep.configuration)),
            createdAt: now,
            updatedAt: now,
        }], {returning: true, transaction});
        stepIdMap.set(sourceStep.id, insertedStep.id);
    }

    for (const sourceStep of sourceSteps) {
        await queryInterface.bulkUpdate("workflow_step", {
            workflowStepPrevious: stepIdMap.get(sourceStep.workflowStepPrevious) || null,
            workflowStepDocument: stepIdMap.get(sourceStep.workflowStepDocument) || null,
        }, {id: stepIdMap.get(sourceStep.id)}, {transaction});
    }
}

/**
 * Creates AI Chat variants without changing the original workflows.
 *
 * @author Mohammed Rawhani
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            for (const variant of WORKFLOW_VARIANTS) {
                await cloneWorkflow(queryInterface, Sequelize, variant, transaction);
            }
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            const workflowNames = WORKFLOW_VARIANTS.map((variant) => variant.name);
            const workflows = await queryInterface.sequelize.query(
                `SELECT id FROM workflow WHERE name IN (:names)`,
                {
                    replacements: {names: workflowNames},
                    type: Sequelize.QueryTypes.SELECT,
                    transaction,
                },
            );
            const workflowIds = workflows.map((workflow) => workflow.id);
            if (!workflowIds.length) {
                return;
            }

            await queryInterface.bulkDelete("workflow_step", {
                workflowId: {[Sequelize.Op.in]: workflowIds},
            }, {transaction});
            await queryInterface.bulkDelete("workflow", {
                id: {[Sequelize.Op.in]: workflowIds},
            }, {transaction});
        });
    },
};
