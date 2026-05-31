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
            key: "aiModelId",
            label: "AI Model (optional):",
            type: "select",
            options: {
                table: "ai_model",
                name: "name",
                value: "id",
                filter: [
                    {key: "enabled", value: true},
                    {key: "deleted", value: false},
                ]
            },
            icon: "robot",
            required: false,
            advanced: true,
            help: "Enable AI features for this study by selecting a model. Leave empty to disable AI in this study."
        }, {
            key: "aiCostLimitPerUser",
            label: "AI cost limit per participant ($):",
            type: "number",
            required: false,
            default: null,
            advanced: true,
            help: "Maximum AI spend per participant. Leave empty for no cap."
        }, {
            key: "aiApplyPerSession",
            label: "Reset AI budget each session?",
            type: "switch",
            default: false,
            advanced: true,
            help: "ON: each session gets a fresh cap. OFF: the cap spans all sessions for the same participant in this study."
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
         * Create the AI budget share row for this study from the coordinator
         * payload. No-op if the form did not supply aiModelId + costLimit.
         * Validates the creator has access to the chosen model before writing.
         *
         * @param {Object} study - Newly created study instance.
         * @param {Object} options - Sequelize options bundle (transaction + context).
         */
        static async createAiBudgetShare(study, options) {
            const ctx = options.context || {};
            const aiModelId = Number(ctx.aiModelId);
            const costLimit = Number(ctx.aiCostLimitPerUser);
            const hasInput =
                Number.isInteger(aiModelId) && aiModelId > 0 &&
                Number.isFinite(costLimit) && costLimit > 0;
            if (!hasInput) return;

            const applyPerSession =
                ctx.aiApplyPerSession === true || ctx.aiApplyPerSession === "true";

            // Validate the creator has access to the chosen model
            // (owner OR active user-scoped share). Prevents arbitrary model
            // ids from arriving via socket.
            const model = await sequelize.models.ai_model.findByPk(aiModelId, {
                transaction: options.transaction,
                raw: true,
            });
            if (!model || model.deleted) {
                throw new Error("Selected AI model does not exist");
            }
            if (model.userId !== study.userId) {
                const ownerShare = await sequelize.models.ai_model_share.findOne({
                    where: {
                        aiModelId,
                        userId: study.userId,
                        studyId: null,
                        studySessionId: null,
                        enabled: true,
                        deleted: false,
                    },
                    transaction: options.transaction,
                });
                if (!ownerShare) {
                    throw new Error("You do not have access to the selected AI model");
                }
            }

            // expiryDate is NOT NULL — use study.end if set, otherwise +1y.
            const fallbackExpiry = new Date();
            fallbackExpiry.setFullYear(fallbackExpiry.getFullYear() + 1);

            await sequelize.models.ai_model_share.create({
                aiModelId,
                userId: null,
                roleId: null,
                studyId: study.id,
                studySessionId: null,
                costLimit,
                applyPerSession,
                expiryDate: study.end || fallbackExpiry,
                enabled: true,
                deleted: false,
            }, {transaction: options.transaction});
        }

        /**
         * Enrich loaded study instances with the AI virtual fields read from
         * the matching ai_model_share row, so the frontend form pre-fills the
         *
         * @param {Object|Object[]} studyOrStudies - Sequelize instance(s) from afterFind.
         * @param {Object} options - Sequelize hook options bundle.
         */
        static async hydrateAiBudgetFields(studyOrStudies, options) {
            const studies = Array.isArray(studyOrStudies)
                ? studyOrStudies.filter(Boolean)
                : (studyOrStudies ? [studyOrStudies] : []);
            if (studies.length === 0) return;

            const studyIds = studies.map((s) => s.id).filter((id) => id != null);
            if (studyIds.length === 0) return;

            const shares = await sequelize.models.ai_model_share.findAll({
                where: {
                    studyId: studyIds,
                    studySessionId: null,
                    deleted: false,
                },
                raw: true,
                transaction: options && options.transaction,
            });
            const shareByStudyId = new Map(shares.map((s) => [s.studyId, s]));

            for (const study of studies) {
                const share = shareByStudyId.get(study.id);
                const values = {
                    aiModelId: share ? share.aiModelId : null,
                    aiCostLimitPerUser: share ? share.costLimit : null,
                    aiApplyPerSession: share ? !!share.applyPerSession : false,
                };
                // where `study` is a plain object without setDataValue. Assign
                // directly 
                if (typeof study.setDataValue === "function") {
                    for (const [key, value] of Object.entries(values)) {
                        study.setDataValue(key, value);
                    }
                } else {
                    Object.assign(study, values);
                }
            }
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

                await Study.createStudySteps(study, options);
                await Study.createAiBudgetShare(study, options);
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
                }

                // Check if this is a versioning operation (_isVersioning is a custom flag)
                // Only when it is NOT a versioning operation, we will trigger handleConfiguration method.
                if (study.closed && !options._isVersioning) {
                    await Study.handleConfiguration(study, transaction);
                }

                // NOTE: Comment out the following update operation since we now use versioning.
                // We only update if the context and stepDocuments are available
                // if (options.context && options.context.stepDocuments) {
                //     await Study.deleteStudySteps(study, options);
                //     await Study.createStudySteps(study, options);
                // }
            },
            afterFind: async (studyOrStudies, options) => {
                // Never let AI-field hydration break study loading/sync.
                try {
                    await Study.hydrateAiBudgetFields(studyOrStudies, options);
                } catch (err) {
                    console.error("hydrateAiBudgetFields failed:", err);
                }
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
