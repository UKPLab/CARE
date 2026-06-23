'use strict';
const MetaModel = require("../MetaModel.js");
const SequelizeSimpleCache = require("sequelize-simple-cache");

module.exports = (sequelize, DataTypes) => {
    class Study extends MetaModel {
        static autoTable = {
            foreignTables: [{
                table: "study_step",
                by: "studyId"
            }]
        };

        static accessMap = [
            {
                right: "frontend.dashboard.studies.fullAccess",
                columns: this.getAttributes()
            },
            {
                table: "study_session",
                by: "studyId",
                columns: this.getAttributes()
            }
        ];

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
                value: "id",
                filter: [
                    {key: "hideInFrontend", value: false },
                    {key: "userId", value: null},
                    {type: "byUserId", key: "userId"}
                ]
            },
            icon: "list",
            required: true,
            help: "Choose a workflow template for the study steps."
        }, {
            key: "tagSetId",
            label: "Tag set for the study:",
            type: "select",
            options: {
                table: "tag_set",
                value: "id",
                name: "name",
                filter: [
                    {
                        key: "public", value: "true"
                    }
                ]
            },
            icon: "list",
            required: true,
            help: "Select a tag set to use in the study."
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
                    ],
                    disabled: [
                        {type: "disabledItems", key: "workflowStepDocument", value: null},
                    ],
                    name: "name"
                }
            }, 
            required: true,
        }, {
            key: "description",
            label: "Description of the study:",
            help: "This text will be displayed at the beginning of the user study!",
            type: "editor",
            required: true
        }, {
            key: "enableEmailNotifications",
            label: "Send email notification on session start/finish",
            type: "switch",
            default: false,
            help: "When enabled, the study owner receives an email each time a participant starts or finishes a session."
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
            textMapping: [{from: 0, to: "unlimited"}],
            advanced: true
        }, {
            key: "limitSessions",
            type: "slider",
            label: "Limit the number of sessions for the study:",
            help: "Set the maximum number of times participants can start or resume the study. Each attempt to complete the study is called a session. 0 = unlimited number of sessions.",
            size: 12,
            unit: "Session(s)",
            min: 0,
            max: 200,
            step: 1,
            default: 0,
            textMapping: [{from: 0, to: "unlimited"}],
            advanced: true
        }, {
            key: "limitSessionsPerUser",
            type: "slider",
            label: "Limit the number of sessions per user for the study:",
            help: "Set the maximum number of times each participant can start or resume the study. Each attempt to complete the study is called a session. 0 = unlimited number of sessions per user.",
            size: 12,
            unit: "Session(s)",
            min: 0,
            max: 200,
            step: 1,
            default: 0,
            textMapping: [{from: 0, to: "unlimited"}],
            advanced: true
        }, {
            key: "start",
            label: "Study sessions can't start before",
            type: "datetime",
            size: 6,
            default: null,
            advanced: true
        }, {
            key: "end",
            label: "Study sessions can't start after:",
            type: "datetime",
            size: 6,
            default: null,
            advanced: true
        }, {
            key: "collab",
            label: "Should the study be collaborative?",
            type: "switch",
            default: false,
            advanced: true
        }, {
            key: "anonymize",
            label: "Should the comments be anonymized?",
            type: "switch",
            default: false,
            advanced: true
        }, {
            key: "resumable",
            label: "Should the study be resumable?",
            type: "switch",
            default: false,
            advanced: true
        }, {
            key: "multipleSubmit",
            label: "Allow multiple submissions?",
            type: "switch",
            default: false,
            help: "Specify whether participants can submit their study multiple times.",
            advanced: true
        }, {
            key: "aiCostLimitTotal",
            label: "AI cost limit - total ($):",
            type: "number",
            required: false,
            default: null,
            advanced: true,
            help: "Total AI spend allowed in this study across all participants. Leave empty for no cap."
        }, {
            key: "aiCostLimitPerSession",
            label: "AI cost limit - per session ($):",
            type: "number",
            required: false,
            default: null,
            advanced: true,
            help: "AI spend allowed in a single session. Leave empty for no per-session cap."
        }, {
            key: "aiCostLimitPerUser",
            label: "AI cost limit - per participant ($):",
            type: "number",
            required: false,
            default: null,
            advanced: true,
            help: "AI spend allowed per participant in this study. Leave empty for no per-participant cap."
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
            const documentIds = [...new Set(studySteps.map((step) => step.documentId).filter(Boolean))];

            for (const studyStep of studySteps) {
                await sequelize.models.study_step.deleteById(studyStep.id, {transaction: options.transaction});
            }
        }

        /**
         * Delete all study sessions for a study.
         * @param study - The study object.
         * @param options - Sequelize options object.
         * @returns {Promise<void>}
         */
        static async deleteStudySessions(study, options) {
            const studySessions = await sequelize.models.study_session.getAllByKey("studyId", study.id);

            for (const studySession of studySessions) {
                await sequelize.models.study_session.deleteById(studySession.id, {transaction: options.transaction});
            }
        }

        /**
         * Soft-delete every ai_budget row tied to this study or any of its
         * steps. Called when the study is deleted (afterUpdate sees deleted=true)
         * and when the study closes due to a new version (afterUpdate sees
         * closed + _isVersioning). 
         *
         * @param {Object} study - The study being closed or deleted.
         * @param {Object} options - Sequelize options bundle (transaction + context).
         */
        static async deleteAiBudgets(study, options) {
            const {Op} = require("sequelize");
            const transaction = options.transaction;
            const db = sequelize.models;

            const steps = await db.study_step.findAll({
                where: {studyId: study.id},
                attributes: ["id"],
                raw: true,
                transaction,
            });
            const stepIds = steps.map((s) => s.id);

            const orClauses = [{studyId: study.id}];
            if (stepIds.length > 0) {
                orClauses.push({studyStepId: {[Op.in]: stepIds}});
            }

            // individualHooks: true makes Sequelize load each matching row
            // and fire the per-instance afterUpdate hook. 
            await db.ai_budget.update(
                {deleted: true, deletedAt: new Date()},
                {
                    where: {deleted: false, [Op.or]: orClauses},
                    transaction,
                    context: options.context,
                    individualHooks: true,
                }
            );
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

            for (let i = 0; i < workflowSteps.length; i++) {
                const workflowStep = workflowSteps[i];
                const stepDocument = options.context.stepDocuments.find(doc => doc.id === workflowStep.id);
                const customConfig = stepDocument?.configuration || {};
                
                // Create context object that includes study data
                const studyContext = {
                    ...study.dataValues || study
                };
                
                const plainStudyStep = await sequelize.models.study_step.add({
                    studyId: study.id,
                    stepNumber: i + 1,
                    stepType: workflowStep.stepType,
                    workflowStepId: workflowStep.id,
                    documentId: (stepDocument && stepDocument.documentId) ? stepDocument.documentId : null,
                    studyStepPrevious: previousStepId,
                    allowBackward: workflowStep.allowBackward,
                    studyStepDocument: null,
                    configuration: customConfig
                }, { transaction: options.transaction, context: studyContext, doNotDuplicate: options.doNotDuplicate});

                const studyStep = await sequelize.models.study_step.findByPk(plainStudyStep.id, {
                    transaction: options.transaction
                });

                studyStepsMap[workflowStep.id] = studyStep;
                previousStepId = studyStep.id;
            }

            // Update studyStepDocument references correctly
            for (const workflowStep of workflowSteps) {
                if (workflowStep.workflowStepDocument) {
                    const currentStudyStep = studyStepsMap[workflowStep.id];  
                    const referencedStudyStep = studyStepsMap[workflowStep.workflowStepDocument];
                    if (currentStudyStep && referencedStudyStep) {
                        await currentStudyStep.update(
                            {studyStepDocument: referencedStudyStep.id},
                            {transaction: options.transaction}
                        );
                    }
                }
            }

            const usedDocumentIds = [...new Set(
                Object.values(studyStepsMap)
                    .map((step) => step.documentId)
                    .filter(Boolean)
            )];

            // Return the workflowStepId → studyStep map so callers 
            return studyStepsMap;
        }

        /**
         * Persist AI budget caps requested by the coordinator payload.
         * Two layers are written here:
         *   - one study-level cap row per limitType (TOTAL/PER_SESSION/PER_USER)
         *   - one step-hook cap row per (studyStep, hook, limitType)
         *
         * Budget shape in options.context.budgets:
         *   {
         *     study: { total?, perSession?, perUser? },
         *     steps: [{ workflowStepId, hooks: [{ hookId, total?, perSession?, perUser? }] }]
         *   }
         *
         * @param {Object} study - Newly created study row.
         * @param {Object} options - Sequelize options bundle (transaction + context).
         * @param {Object} studyStepsMap - workflowStepId → study_step instance.
         */
        static async createBudgets(study, options, studyStepsMap) {
            const ctx = options.context || {};
            const { AI_BUDGET_LIMIT_TYPES: LT } = require("../../utils/aiBudgetLimitTypes");
            const Budget = sequelize.models.ai_budget;
            const { transaction } = options;

            // Each create runs in the same transaction that's writing the
            // study and its steps. options.context is forwarded so the
            // ai_budget.validateOwner hook sees the caller's userId.
            const createCap = (rowData) =>
                Budget.create(
                    { ...rowData, deleted: false },
                    { transaction, context: options.context }
                );

            // Study-level caps, read from the three virtual fields on the coordinator form (aiCostLimitTotal / PerSession / PerUser).
            const studyDimensions = [
                [ctx.aiCostLimitTotal, LT.TOTAL],
                [ctx.aiCostLimitPerSession, LT.PER_SESSION],
                [ctx.aiCostLimitPerUser, LT.PER_USER],
            ];
            for (const [rawValue, limitType] of studyDimensions) {
                const value = Number(rawValue);
                if (Number.isFinite(value) && value > 0) {
                    await createCap({ studyId: study.id, limitType, costLimit: value });
                }
            }

            // Step-hook caps — live in each step's configuration.services[]
            
            const stepDocuments = Array.isArray(ctx.stepDocuments) ? ctx.stepDocuments : [];
            for (const stepDoc of stepDocuments) {
                const studyStep = studyStepsMap[stepDoc?.id];
                if (!studyStep) continue;
                const services = Array.isArray(stepDoc.configuration?.services) ? stepDoc.configuration.services : [];
                for (const serviceEntry of services) {
                    const hookId = Number(serviceEntry?.hookId);
                    if (!Number.isInteger(hookId) || hookId <= 0) continue;
                    const hookDimensions = [
                        [serviceEntry.capTotal, LT.TOTAL],
                        [serviceEntry.capPerSession,  LT.PER_SESSION],
                        [serviceEntry.capPerUser, LT.PER_USER],
                    ];
                    for (const [rawValue, limitType] of hookDimensions) {
                        const value = Number(rawValue);
                        if (Number.isFinite(value) && value > 0) {
                            await createCap({
                                studyStepId: studyStep.id,
                                hookId,
                                limitType,
                                costLimit: value,
                            });
                        }
                    }
                }
            }
        }

        /**
         * When a user updates a study, we create a new version of the study and close the old one
         * @param {object} study - The study object
         * @param {object} options - Sequelize options object
         * @returns {Promise<void>}
         */
        static async updateStudy(study, options) {
            // Capture the updated data before we reset the instance
            const updatedData = study.toJSON();
            // Reload the original study data to reset all changes
            await study.reload({ transaction: options.transaction });
            // Create a new study with the updated data
            const newStudyData = { ...updatedData };
            delete newStudyData.id;
            delete newStudyData.hash;
            newStudyData.parentStudyId = study.id;
            // Create the new study version
            await Study.add(newStudyData, {
                transaction: options.transaction,
                context: options.context
            });

            study.setDataValue("closed", new Date());

            // Introduce the custom flag '_isVersioning' to mark this as a versioning operation
            options._isVersioning = true;

            // Specify which fields to be updated. (If fields is provided, only those columns will be saved)
            options.fields = ["closed"];
        }

        /**
         * Handle possible configuration from study steps
         * @param {Object} study
         * @param {Object} transaction
         */
        static async handleConfiguration(study, transaction) {

            const studySteps = await sequelize.models.study_step.getAllByKey("studyId", study.id, {transaction: transaction});

            /*
            // TODO - In the future, we will search/filter for the questionnaire configuration in the study steps
            const questionnaireConfig = studySteps
                .map(step => step.configuration?.questionnaire)
                .find(q => q);

            if (!questionnaireConfig) {
                console.warn('No questionnaire configuration found in the study steps.');
                return;
            }
             */
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
            
            Study.belongsTo(models["project"], {
                foreignKey: "projectId",
                as: "project"
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
        tagSetId: DataTypes.INTEGER,
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
        createdAt: DataTypes.DATE,
        projectId: DataTypes.INTEGER,
        anonymize: DataTypes.BOOLEAN,
        enableEmailNotifications: DataTypes.BOOLEAN,
        parentStudyId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null
        }
    }, {
        sequelize: sequelize, modelName: 'study', tableName: 'study', hooks: {
            beforeCreate: async (study, options) => {
            // Set default projectId from user settings if not provided
                const userId = study.dataValues.userId;
                const defaultProjectId = await sequelize.models.user_setting.get('projects.default', userId);        
                if (defaultProjectId) {
                    study.dataValues.projectId = parseInt(defaultProjectId);
                }
            },
            afterCreate: async (study, options) => {

                if (!options.context || !options.context.stepDocuments) {
                    throw new Error("Missing context or stepDocuments in options. Cancelling transaction.");
                }

                const studyStepsMap = await Study.createStudySteps(study, options);
                await Study.createBudgets(study, options, studyStepsMap || {});
            },
            beforeUpdate: async (study, options) => {
                // Keep close metadata in model layer to avoid transport-specific logic.
                if (study.changed("closed") && study.closed && !study.userIdClosed) {
                    const closingUserId = options.context?.currentUserId;
                    if (closingUserId) {
                        study.setDataValue("userIdClosed", closingUserId);
                    }
                }

                // If this is a study update (not a close operation) and we have stepDocuments
                if (options.context?.stepDocuments && !study.closed) {
                    await Study.updateStudy(study, options);
                }
            },
            afterUpdate: async (study, options) => {
                const transaction = options.transaction;

                if (study.deleted) {
                    await Study.deleteStudySteps(study, options);
                    await Study.deleteStudySessions(study, options);
                    await Study.deleteAiBudgets(study, options);
                }

                // Check if this is a versioning operation (_isVersioning is a custom flag)
                // Only when it is NOT a versioning operation, we will trigger handleConfiguration method.
                if (study.closed && !options._isVersioning) {
                    await Study.handleConfiguration(study, transaction);
                }

                // Versioning just closed this study; soft-delete its budget rows
                // (study-level + step-hook) so they don't linger as orphans on
                // the closed version. 
                if (study.closed && options._isVersioning) {
                    await Study.deleteAiBudgets(study, options);
                }

                // NOTE: Comment out the following update operation since we now use versioning.
                // We only update if the context and stepDocuments are available
                // if (options.context && options.context.stepDocuments) {
                //     await Study.deleteStudySteps(study, options);
                //     await Study.createStudySteps(study, options);
                // }
            }
        },
        indexes: [
            {
            unique: false,
            fields: ["userId", "template"]
            },
            {
            unique: true,
            fields: ["id"]
            }
        ]
    });

    Study.cache = new SequelizeSimpleCache({study: {limit: 50, ttl: false}});
    return Study.cache.init(Study);
};
