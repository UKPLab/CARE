'use strict';
const MetaModel = require("../MetaModel.js");
const SequelizeSimpleCache = require("sequelize-simple-cache");
const {Op} = require("sequelize");
const {STATES} = require("../studyDashboardSortSql.js");

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
            const created = await Study.add(newStudyData, {
                transaction: options.transaction,
                context: options.context
            });
            // Sequelize cloneDeep's update options, so mutating context is lost.
            // The transaction object is shared for the whole appDataUpdate call.
            if (created) {
                const published = {id: created.id, hash: created.hash};
                if (options.transaction) {
                    options.transaction.versionedStudy = published;
                }
                if (options.context) {
                    options.context.versionedStudy = published;
                }
            }

            study.setDataValue("closed", new Date());

            // Introduce the custom flag '_isVersioning' to mark this as a versioning operation
            options._isVersioning = true;

            // Specify which fields to be updated. (If fields is provided, only those columns will be saved)
            options.fields = ["closed"];
        }

        /**
         * Success modal needs the live study {id, hash}. Create and versioning
         * return that; delete / close / restart stay a numeric id.
         */
        static async resolveAppDataResult({data, transaction, context, entry}) {
            const published = transaction?.versionedStudy || context?.versionedStudy;
            if (published?.hash) {
                return published;
            }
            const originalId = data?.id;
            const isCreate = !originalId || originalId === 0;
            if (!isCreate && context?.stepDocuments) {
                const child = await Study.findOne({
                    where: {parentStudyId: originalId, deleted: false},
                    order: [["id", "DESC"]],
                    transaction,
                });
                if (child?.hash) {
                    return {id: child.id, hash: child.hash};
                }
            }
            if (isCreate && entry?.hash) {
                return {id: entry.id, hash: entry.hash};
            }
            return entry?.id;
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

            Study.hasOne(models["study_dashboard_sort"], {
                foreignKey: "id",
                sourceKey: "id",
                as: "dashboardSort",
                constraints: false,
            });
        }

        /**
         * queryTable ORDER BY for columns that are not study fields.
         * Values live on materialized view study_dashboard_sort.
         * @returns {Object<string, {field: string}>}
         */
        static getQueryTableSortColumns() {
            return {
                state: {field: "stateRank"},
                sessions: {field: "sessions"},
            };
        }

        /**
         * Row visibility for non-admin / non-fullAccess users.
         * (createdByUserId IS NULL AND userId = me) OR (createdByUserId = me).
         * @param {number} userId
         * @returns {Promise<Object>}
         */
        static async getUserFilter(userId) {
            return {
                [Op.or]: [
                    {[Op.and]: [{createdByUserId: null}, {userId}]},
                    {createdByUserId: userId},
                ],
            };
        }

        /**
         * Related fields to attach in queryTable / query-mode deltas.
         * @param {Object} ctx
         * @param {function(string): Promise<boolean>} ctx.hasAccess
         * @returns {Promise<Array<Object>>}
         */
        static async getQueryTableInjects(ctx) {
            const injects = [
                {type: "count", table: "study_session", by: "studyId", as: "sessions"},
            ];
            if (await ctx.hasAccess("frontend.dashboard.studies.view.userPrivateInfo")) {
                injects.push({
                    type: "parent",
                    table: "user",
                    by: "userId",
                    fields: ["firstName", "lastName"],
                });
            }
            return injects;
        }

        /**
         * Searchable keys aligned with visible Studies dashboard columns (not every DB field).
         * Virtual keys: sessions / state (materialized view), firstName/lastName (parent inject).
         * @param {Object} ctx
         * @param {function(string): Promise<boolean>} ctx.hasAccess
         * @returns {Promise<string[]>}
         */
        static async getQueryTableSearchColumns(ctx) {
            const columns = ["id", "name", "sessions", "state", "workflowName"];
            if (await ctx.hasAccess("frontend.dashboard.studies.view.userPrivateInfo")) {
                columns.push("firstName", "lastName");
            }
            return columns;
        }

        /**
         * Free-text match on the workflow title, which is not a study column.
         * Only applied for consumers that show a Workflow column (Manage Studies).
         * @param {string} needle already lowercased and length-capped
         * @param {Object} [ctx]
         * @param {function(string): boolean} [ctx.canSearch]
         * @returns {Array<Object>}
         */
        static getQueryTableSearchConditions(needle, ctx = {}) {
            if (typeof ctx.canSearch === "function" && !ctx.canSearch("workflowName")) {
                return [];
            }
            const escaped = sequelize.escape(needle);
            return [{
                workflowId: {
                    [Op.in]: sequelize.literal(
                        "(SELECT \"workflow\".\"id\" FROM \"workflow\"" +
                        ` WHERE STRPOS(LOWER("workflow"."name"), ${escaped}) > 0` +
                        " AND \"workflow\".\"deleted\" = false)"
                    ),
                },
            }];
        }

        /**
         * Free-text search on study_dashboard_sort (same values as sort/filter).
         * @returns {Array<{key: string, field: string, castText?: boolean}>}
         */
        static getQueryTableViewSearchFields() {
            return [
                {key: "state", field: "state"},
                {key: "sessions", field: "sessions", castText: true},
            ];
        }

        /**
         * Keys the Studies search bar may filter on.
         * state / sessions read the materialized view; workflowName / ownerName are correlated
         * subqueries; other keys are study columns.
         * A filter token for anything outside this spec is dropped server-side.
         * @param {Object} [ctx]
         * @param {function(string): Promise<boolean>} [ctx.hasAccess]
         * @returns {Promise<Object>}
         */
        static async getQueryTableFilterColumns(ctx = {}) {
            const spec = {
                state: {type: "enum", values: STATES, viewField: "state"},
                id: {type: "numeric", operators: ["=", ">", ">=", "<", "<="]},
                createdAt: {type: "date"},
                sessions: {type: "numeric", viewField: "sessions"},
                limitSessions: {type: "numeric"},
                limitSessionsPerUser: {type: "numeric"},
                workflow: {type: "exists", field: "workflowId"},
                workflowName: {
                    type: "text",
                    sql: "(SELECT \"workflow\".\"name\" FROM \"workflow\"" +
                        " WHERE \"workflow\".\"id\" = \"study\".\"workflowId\")",
                },
                collab: {type: "boolean"},
                resumable: {type: "boolean"},
                multipleSubmit: {type: "boolean"},
                enableEmailNotifications: {type: "boolean"},
            };
            // Owner name is the same gated data as the firstName / lastName inject.
            if (typeof ctx.hasAccess === "function"
                && await ctx.hasAccess("frontend.dashboard.studies.view.userPrivateInfo")) {
                spec.ownerName = {
                    type: "text",
                    sql: "(SELECT TRIM(CONCAT_WS(' ', \"user\".\"firstName\", \"user\".\"lastName\"))" +
                        " FROM \"user\" WHERE \"user\".\"id\" = \"study\".\"userId\")",
                };
            }
            return spec;
        }

        /**
         * Columns a client may ask distinct values for (dropdown options within the current query).
         * @returns {string[]}
         */
        static getQueryTableDistinctColumns() {
            return ["workflowId"];
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
            }
        },
        indexes: [
            {
                unique: false,
                fields: ["userId", "template"]
            },
            {
                unique: false,
                name: "study_project_list_created",
                fields: ["projectId", "deleted", "template", "createdAt", "id"]
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
