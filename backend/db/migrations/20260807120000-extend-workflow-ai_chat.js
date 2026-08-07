'use strict';

const workflow = {
    name: "Peer Review Workflow (Assessment with AI Chat)",
    description: "Peer Review Workflow with Assessment, AI assessment, and AI Chat.",
    steps: [
        {
            name: "Annotator",
            stepType: 1,
            allowBackward: false,
            workflowStepDocument: null,
            configuration: {
                settings: {
                    fields: [
                        {
                            key: "configurationId",
                            label: "Configuration File:",
                            type: "select",
                            required: true,
                            options: {
                                table: "configuration",
                                name: "name",
                                value: "id",
                                filter: [
                                    {key: "type", value: 0},
                                    {key: "deleted", value: false},
                                ],
                            },
                            help: "Select the configuration file for this workflow step.",
                        },
                        {
                            key: "forcedAssessment",
                            label: "Forced Assessment",
                            type: "switch",
                            required: false,
                            default: false,
                            help: "If enabled, reviewers must save a score and justification for every criterion before they can proceed.",
                        },
                    ],
                },
                services: [
                    {
                        name: "nlpAssessment",
                        type: "nlpRequest",
                        required: true,
                    },
                    {
                        name: "aiChat",
                        type: "aiChat",
                        required: true,
                        outputMapping: false,
                    },
                ],
                placeholders: false,
            },
        },
        {
            name: "Editor",
            stepType: 2,
            allowBackward: true,
            workflowStepDocument: 1,
            configuration: {
                services: [
                    {
                        name: "textualFeedback",
                        type: "nlpRequest",
                        required: true,
                    },
                    {
                        name: "aiChat",
                        type: "aiChat",
                        required: true,
                        outputMapping: false,
                    },
                ],
                placeholders: false,
            },
        },
    ],
};

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            const now = new Date();
            const [insertedWorkflow] = await queryInterface.bulkInsert('workflow', [{
                name: workflow.name,
                description: workflow.description,
                createdAt: now,
                updatedAt: now,
            }], {returning: true, transaction});

            const stepIds = [];
            let previousStepId = null;

            for (const step of workflow.steps) {
                const [insertedStep] = await queryInterface.bulkInsert('workflow_step', [{
                    name: step.name,
                    workflowId: insertedWorkflow.id,
                    stepType: step.stepType,
                    workflowStepPrevious: previousStepId,
                    allowBackward: step.allowBackward,
                    workflowStepDocument: null,
                    configuration: JSON.stringify(step.configuration),
                    createdAt: now,
                    updatedAt: now,
                }], {returning: true, transaction});

                stepIds.push(insertedStep.id);
                previousStepId = insertedStep.id;
            }

            for (let index = 0; index < workflow.steps.length; index++) {
                const documentStep = workflow.steps[index].workflowStepDocument;
                if (documentStep !== null) {
                    await queryInterface.bulkUpdate('workflow_step', {
                        workflowStepDocument: stepIds[documentStep - 1],
                    }, {id: stepIds[index]}, {transaction});
                }
            }
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            const workflows = await queryInterface.sequelize.query(
                'SELECT id FROM workflow WHERE name = :name',
                {
                    replacements: {name: workflow.name},
                    type: Sequelize.QueryTypes.SELECT,
                    transaction,
                }
            );
            const workflowIds = workflows.map((entry) => entry.id);

            if (workflowIds.length === 0) {
                return;
            }

            await queryInterface.bulkDelete('workflow_step', {
                workflowId: {[Sequelize.Op.in]: workflowIds},
            }, {transaction});
            await queryInterface.bulkDelete('workflow', {
                id: {[Sequelize.Op.in]: workflowIds},
            }, {transaction});
        });
    },
};
