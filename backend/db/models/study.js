'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class Study extends MetaModel {
        static autoTable = true;
        static fields = [{
            key: "name",
            label: "Name of the study:",
            placeholder: "My user study",
            type: "text",
            required: true, //pattern: "^(\\d+)",
            //invalidText: "Test invalid text",
            default: "",
            minlength: 4,
            maxlength: 5
        }, {
            key: "workflowId",
            label: "Select Workflow for Study:",
            type: "select",
            options: {
                table: "workflow",
                name: "name",
                value: "id"
            },
            icon: "list",
            required: true,
            help: "Choose a workflow template for the study steps."
        }, {
            key: "stepDocuments",
            label: "Assign Documents to Workflow Steps:",
            type: "choice",
            options: {
                table: "study_step",
                id: "studyId",
                filter: {
                    table: "workflow_step"
                },
                sort: [
                    {
                        type: "graph",
                        key: "studyStepPrevious",
                    }
                ],
                choices: {
                    table: "workflow_step",
                    key: "id",
                    sort: [
                        {
                            type: "graph",
                            key: "workflowStepPrevious",
                        }
                    ],
                    filter: [
                        {type: "formData", key: "workflowId", value: "workflowId"},
                        {key: "workflowStepDocument", value: null}
                    ],
                    name: "name"
                }
            }, required: true,
        }, {
            key: "description",
            label: "Description of the study:",
            help: "This text will be displayed at the beginning of the user study!",
            type: "editor",
            required: true
        }, {
            key: "timeLimit",
            type: "slider",
            label: "How much time does a participant have for the study?",
            help: "0 = disable time limitation",
            size: 12,
            unit: "min",
            min: 0,
            max: 180,
            step: 1,
            default: 0,
        }, {
            key: "limitSessions",
            type: "slider",
            label: "Limit the number of sessions for the study:",
            help: "Set the maximum number of times participants can start or resume the study. Each attempt to complete the study is called a session. 0 = unlimited number of sessions.",
            size: 12,
            unit: "Sessions",
            min: 0,
            max: 200,
            step: 1,
            default: 0,
        }, {
            key: "limitSessionsPerUser",
            type: "slider",
            label: "Limit the number of sessions per user for the study:",
            help: "Set the maximum number of times each participant can start or resume the study. Each attempt to complete the study is called a session. 0 = unlimited number of sessions per user.",
            size: 12,
            unit: "Sessions",
            min: 0,
            max: 200,
            step: 1,
            default: 0,
        }, {
            key: "collab",
            label: "Should the study be collaborative?",
            type: "switch",
            default: false,
        }, {
            key: "resumable",
            label: "Should the study be resumable?",
            type: "switch",
            default: false,
        }, {
            key: "multipleSubmit",
            label: "Allow multiple submissions?",
            type: "switch",
            default: false,
            help: "Specify whether participants can submit their study multiple times."
        }, {
            key: "start",
            label: "Study sessions can't start before",
            type: "datetime",
            size: 6,
            default: null,
        }, {
            key: "end",
            label: "Study sessions can't start after:",
            type: "datetime",
            size: 6,
            default: null,
        },];

        /**
         * Check if a study is still open
         * @param studyId
         * @returns {Promise<void>}
         * @throws Error if study is closed
         */
        static async checkStudyOpen(studyId) {
            const study = await sequelize.models.study.getById(studyId);
            if (study) {
                if (study.closed) {
                    throw new Error('This study is closed');
                }
                if (!study.multipleSubmit && study.end && new Date(study.end) < new Date()) {
                    throw new Error('This study has ended');
                }
            } else {
                throw new Error('Study not found');
            }
        }

        /**
         * Delete all study steps for a study
         * @param study - The study object
         * @param options - Sequelize options object
         * @returns {Promise<void>}
         */
        static async deleteStudySteps(study, options) {
            const studySteps = await sequelize.models.study_step.getAllByKey("studyId", study.id);

            for (const studyStep of studySteps) {
                await sequelize.models.study_step.deleteById(studyStep.id, {transaction: options.transaction});
            }
        }

        /**
         * Create study steps for a study
         * @param study - The study object
         * @param options - Sequelize options object
         * @returns {Promise<void>}
         */
        static async createStudySteps(study, options) {
            const workflowSteps = await sequelize.models.workflow_step.getSortedWorkflowSteps(study.workflowId);
            const studyStepsMap = {}; 
            let previousStepId = null;

            for (const workflowStep of workflowSteps) {
                const stepDocument = options.context.stepDocuments.find(doc => doc.id === workflowStep.id);
                const studyStep = await sequelize.models.study_step.create({
                    studyId: study.id,
                    stepType: workflowStep.stepType,
                    workflowStepId: workflowStep.id,
                    documentId: (stepDocument && stepDocument.documentId) ? stepDocument.documentId : null,
                    studyStepPrevious: previousStepId,
                    allowBackward: workflowStep.allowBackward,
                    workflowStepDocument: null, 
                    configuration: workflowStep.configuration
                }, {transaction: options.transaction, context: study});
        
                studyStepsMap[workflowStep.id] = studyStep;
        
                // If the workflowStepDocument references a previous workflowStep
                if (workflowStep.workflowStepDocument) {
                    const referencedStudyStep = studyStepsMap[workflowStep.workflowStepDocument];
                    if (referencedStudyStep) {
                        await studyStep.update(
                            { workflowStepDocument: referencedStudyStep.id },
                            { transaction: options.transaction }
                        );
                    }
                }

                previousStepId = studyStep.id;
            }

        }

        static associate(models) {
            // define association here
            Study.belongsTo(models["user"], {
                foreignKey: "userId", as: "user"
            });

            // Association with the workflow model
            Study.belongsTo(models["workflow"], {
                foreignKey: "workflowId", as: "workflow"
            });

            // Association with study sessions
            Study.hasMany(models["study_session"], {
                foreignKey: "studyId", as: "sessions"
            });

            // Association with study steps
            Study.hasMany(models["study_step"], {
                foreignKey: "studyId", as: "steps"
            });
        }

    }

    Study.init({
        name: DataTypes.STRING,
        hash: DataTypes.STRING,
        userId: DataTypes.INTEGER,
        createdByUserId: DataTypes.INTEGER,
        workflowId: DataTypes.INTEGER,
        collab: DataTypes.BOOLEAN,
        resumable: DataTypes.BOOLEAN,
        description: DataTypes.TEXT,
        timeLimit: DataTypes.INTEGER,
        multipleSubmit: DataTypes.BOOLEAN,
        limitSessions: DataTypes.INTEGER,
        limitSessionsPerUser: DataTypes.INTEGER,
        closed: DataTypes.DATE,
        userIdClosed: DataTypes.INTEGER,
        template: DataTypes.BOOLEAN,
        start: DataTypes.DATE,
        end: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE
    }, {
        sequelize: sequelize, modelName: 'study', tableName: 'study', hooks: {
            afterCreate: async (study, options) => {

                // Skip step creation for template studies
                if (study.template) {
                    return;
                }

                // Check if the context and stepDocuments are available - needed for study creation!!!
                if (!options.context || !options.context.stepDocuments) {
                    throw new Error("Missing context or stepDocuments in options. Cancelling transaction.");
                }

                await Study.createStudySteps(study, options);

            }, afterUpdate: async (study, options) => {

                // We only update if the context and stepDocuments are available
                if (options.context && options.context.stepDocuments) {
                    await Study.deleteStudySteps(study, options);
                    await Study.createStudySteps(study, options);
                }

            }
        }
    });

    return Study;
};
