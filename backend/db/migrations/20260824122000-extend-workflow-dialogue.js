"use strict";

const dialoguePlanField = {
    key: "dialoguePlanConfigurationId",
    label: "Dialogue Plan Configuration File:",
    type: "select",
    required: true,
    options: {
        table: "configuration",
        name: "name",
        value: "id",
        filter: [
            {key: "type", value: 2},
            {key: "deleted", value: false},
        ],
    },
    help: "Select the configuration file for this Dialogue step.",
};

const assessmentConfigurationField = {
    key: "configurationId",
    label: "Assessment Configuration File:",
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
    help: "Select the configuration file for assessment sidebar.",
};

const workflows = [
    {
        name: "Dialogue Workflow (Fixed)",
        description: "Single-step Dialogue workflow for fixed questionnaires, surveys, or exams.",
        steps: [
            {
                name: "Dialogue",
                stepType: 4,
                allowBackward: false,
                workflowStepDocument: null,
                configuration: {
                    settings: {fields: [dialoguePlanField]},
                    placeholders: false,
                },
            },
        ],
    },
    {
        name: "Post-validation Dialogue Workflow (AI Adaptive)",
        description: "Two read-only peer reviews followed by an adaptive AI Dialogue step.",
        steps: [
            {
                name: "First Review",
                stepType: 1,
                allowBackward: false,
                workflowStepDocument: null,
                configuration: {
                    settings: {
                        fields: [
                            assessmentConfigurationField,
                            {
                                key: "showAllDocumentAnnotations",
                                label: "Show all document Annotations",
                                type: "switch",
                                required: false,
                                default: true,
                                help: "If enabled, all document annotations will be shown to the reviewer.",
                            },
                        ],
                    },
                    readOnlyComponents: ["annotator", "assessment"],
                    placeholders: false,
                },
            },
            {
                name: "First Review Feedback",
                stepType: 2,
                allowBackward: true,
                workflowStepDocument: null,
                configuration: {
                    readOnlyComponents: ["editor"],
                    placeholders: false,
                },
            },
            {
                name: "Second Review",
                stepType: 1,
                allowBackward: true,
                workflowStepDocument: null,
                configuration: {
                    settings: {
                        fields: [
                            assessmentConfigurationField,
                            {
                                key: "showAllDocumentAnnotations",
                                label: "Show all document Annotations",
                                type: "switch",
                                required: false,
                                default: true,
                                help: "If enabled, all document annotations will be shown to the reviewer.",
                            },
                        ],
                    },
                    readOnlyComponents: ["annotator", "assessment"],
                    placeholders: false,
                },
            },
            {
                name: "Second Review Feedback",
                stepType: 2,
                allowBackward: true,
                workflowStepDocument: null,
                configuration: {
                    readOnlyComponents: ["editor"],
                    placeholders: false,
                },
            },
            {
                name: "Dialogue",
                stepType: 4,
                allowBackward: true,
                workflowStepDocument: null,
                configuration: {
                    settings: {fields: [dialoguePlanField]},
                    services: [
                        {
                            name: "dialogueContext",
                            type: "aiDialogue",
                            required: true,
                            outputMapping: false,
                        },
                        {
                            name: "dialogueDecision",
                            type: "aiDialogue",
                            required: true,
                            inputMapping: false,
                            outputMapping: false,
                        },
                        {
                            name: "dialogueAnchor",
                            type: "aiDialogue",
                            required: true,
                            inputMapping: false,
                            outputMapping: false,
                        },
                    ],
                    placeholders: false,
                },
            },
        ],
    },
];

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            const now = new Date();
            const workflowInsertions = await queryInterface.bulkInsert(
                "workflow",
                workflows.map((workflow) => ({
                    name: workflow.name,
                    description: workflow.description,
                    createdAt: now,
                    updatedAt: now,
                })),
                {returning: true, transaction}
            );

            const workflowMap = {};
            workflowInsertions.forEach((workflow, index) => {
                workflowMap[workflows[index].name] = workflow.id;
            });

            for (const workflow of workflows) {
                let previousStepId = null;
                const stepIds = [];

                for (const step of workflow.steps) {
                    const [insertedStep] = await queryInterface.bulkInsert("workflow_step", [{
                        name: step.name,
                        workflowId: workflowMap[workflow.name],
                        stepType: step.stepType,
                        workflowStepPrevious: previousStepId,
                        allowBackward: step.allowBackward,
                        workflowStepDocument: null,
                        configuration: JSON.stringify(step.configuration || {}),
                        createdAt: now,
                        updatedAt: now,
                    }], {returning: true, transaction});

                    stepIds.push(insertedStep.id);
                    previousStepId = insertedStep.id;
                }

                for (let index = 0; index < workflow.steps.length; index++) {
                    const documentStep = workflow.steps[index].workflowStepDocument;
                    if (documentStep === null) continue;
                    await queryInterface.bulkUpdate("workflow_step", {
                        workflowStepDocument: stepIds[documentStep - 1],
                    }, {id: stepIds[index]}, {transaction});
                }
            }
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            const workflowNames = workflows.map((workflow) => workflow.name);
            const workflowRecords = await queryInterface.sequelize.query(
                "SELECT id FROM workflow WHERE name IN (:names)",
                {
                    replacements: {names: workflowNames},
                    type: Sequelize.QueryTypes.SELECT,
                    transaction,
                }
            );
            const workflowIds = workflowRecords.map((workflow) => workflow.id);

            if (workflowIds.length === 0) return;

            await queryInterface.bulkDelete("workflow_step", {
                workflowId: {[Sequelize.Op.in]: workflowIds},
            }, {transaction});
            await queryInterface.bulkDelete("workflow", {
                id: {[Sequelize.Op.in]: workflowIds},
            }, {transaction});
        });
    },
};
