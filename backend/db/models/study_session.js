'use strict';
const MetaModel = require("../MetaModel.js");
const SequelizeSimpleCache = require("sequelize-simple-cache");
const TranslatableError = require("../../utils/TranslatableError");
const {Op, literal} = require("sequelize");
const {includesCondition} = require("../../utils/helper/queryTableSearch.js");
const {positiveInt} = require("../../utils/helper/positiveInt.js");

module.exports = (sequelize, DataTypes) => {
    class StudySession extends MetaModel {
        static autoTable = {
            parentTables: [{
                table: "study",
                by: "studyId"
            }]
        };
        static accessMap = [
            {
                right: "frontend.dashboard.studies.fullAccess",
                columns: this.getAttributes()
            },
            {
                table: "study",
                by: "id",
                target: "studyId",
                columns: this.getAttributes()
            }
        ];

        /**
         * When sessions change, refresh session counts on study rows in query-mode tables.
         * @param {Object[]} rows changed study_session rows
         * @returns {Array<{table: string, rows: Object[], operation: string}>}
         */
        static getCompanionBroadcasts(rows) {
            const studyIds = [...new Set(rows.map((row) => row.studyId).filter((id) => id != null))];
            if (!studyIds.length) {
                return [];
            }
            return [{
                table: "study",
                rows: studyIds.map((id) => ({id})),
                operation: "update",
            }];
        }

        /**
         * Shared correlated subqueries for study / session-user / study-owner / submission.
         *
         * @param {boolean} [privateInfo] viewer may read user names / extIds
         * @returns {Object<string, string>} alias → SQL expression
         */
        static sessionIdentitySql(privateInfo = false) {
            const studyField = (field) =>
                `(SELECT "study"."${field}" FROM "study" WHERE "study"."id" = "study_session"."studyId")`;
            const reviewerField = (field) =>
                `(SELECT "reviewer"."${field}" FROM "user" AS "reviewer"`
                + ` WHERE "reviewer"."id" = "study_session"."userId")`;
            const ownerField = (field) =>
                `(SELECT "owner"."${field}" FROM "user" AS "owner"`
                + ` WHERE "owner"."id" = ${studyField("userId")})`;
            // Walk: study_step → document → (parent document) → submission.
            const submissionId =
                '(SELECT COALESCE("stepDocument"."submissionId", "parentDocument"."submissionId")'
                + ' FROM "study_step" AS "sessionStep"'
                + ' INNER JOIN "document" AS "stepDocument"'
                + ' ON "stepDocument"."id" = "sessionStep"."documentId" AND "stepDocument"."deleted" = false'
                + ' LEFT JOIN "document" AS "parentDocument"'
                + ' ON "parentDocument"."id" = "stepDocument"."parentDocumentId"'
                + ' AND "parentDocument"."deleted" = false'
                + ' WHERE "sessionStep"."studyId" = "study_session"."studyId"'
                + ' AND "sessionStep"."deleted" = false'
                + ' ORDER BY (COALESCE("stepDocument"."submissionId", "parentDocument"."submissionId") IS NULL),'
                + ' ("stepDocument"."submissionId" IS NULL), "sessionStep"."id" LIMIT 1)';

            const columns = {
                studyName: studyField("name"),
                studyUserId: studyField("userId"),
                userName: reviewerField("userName"),
                ownerUserName: ownerField("userName"),
                workflowType: '(SELECT "workflow"."name" FROM "workflow"'
                    + ` WHERE "workflow"."id" = ${studyField("workflowId")})`,
                submissionId,
                submissionExtId: `(SELECT "submission"."extId" FROM "submission"`
                    + ` WHERE "submission"."id" = ${submissionId})`,
                
                submissionGroup: `(SELECT COALESCE("submission"."group"::text, '') FROM "submission"`
                    + ` WHERE "submission"."id" = ${submissionId})`,
                status: 'CASE WHEN "study_session"."end" IS NULL THEN \'Running\' ELSE \'Finished\' END',
            };
            if (privateInfo) {
                columns.firstName = reviewerField("firstName");
                columns.lastName = reviewerField("lastName");
                columns.ownerFirstName = ownerField("firstName");
                columns.ownerLastName = ownerField("lastName");
                columns.ownerExtId = ownerField("extId");
                columns.completeUserName =
                    `TRIM(CONCAT_WS(' ', ${reviewerField("firstName")}, ${reviewerField("lastName")}))`;
                columns.studyCompleteUserName =
                    `TRIM(CONCAT_WS(' ', ${ownerField("firstName")}, ${ownerField("lastName")}))`;
            }
            return columns;
        }

        /**
         * Rows of a scoped study_session queryTable.
         *
         * - `scope.assessment`: Publish Assessment — closed studies running a configuration at
         *   picked workflow steps.
         * - `scope.inspect`: Inspect Sessions — one study, owner or admin.
         * - `scope.assignmentBulk`: Add Bulk/Single Assignment — sessions whose study uses the
         *   mapped target workflow.
         *
         * @param {Object} scope
         * @returns {Promise<Object|null>} WHERE fragment, or null when no known scope key is set
         * @throws {TranslatableError} when a known scope key is present but unusable
         */
        static async getQueryTableScopeFilter(scope, ctx = {}) {
            if (scope?.inspect) {
                const studyId = positiveInt(scope.inspect.studyId);
                if (!studyId) {
                    throw new TranslatableError("errors.queryTable.inspectStudyRequired");
                }
                const study = await sequelize.models.study.getById(studyId);
                if (!study) {
                    throw new TranslatableError("errors.studies.studyNotFound");
                }
                const admin = typeof ctx.isAdmin === "function" && await ctx.isAdmin();
                // Owner of this study, or an admin.
                if (!admin && ctx.userId !== study.userId) {
                    throw new TranslatableError("errors.studies.notAllowedToSeeStudy");
                }
                return {studyId};
            }
            if (scope?.assignmentBulk) {
                const workflowId = positiveInt(scope.assignmentBulk.workflowId);
                if (!workflowId) {
                    throw new TranslatableError("errors.queryTable.scopeInvalid");
                }
                return {
                    studyId: {
                        [Op.in]: sequelize.literal(
                            '(SELECT "study"."id" FROM "study"'
                            + ' WHERE "study"."deleted" = false'
                            + ` AND "study"."workflowId" = ${workflowId})`
                        ),
                    },
                };
            }

            const assessment = scope?.assessment;
            if (!assessment) {
                return null;
            }
            const configurationId = positiveInt(assessment.configurationId);
            const projectId = positiveInt(assessment.projectId);
            const steps = (Array.isArray(assessment.steps) ? assessment.steps : [])
                .map((step) => ({
                    workflowId: positiveInt(step?.workflowId),
                    stepNumber: positiveInt(step?.stepNumber),
                }))
                .filter((step) => step.workflowId && step.stepNumber);
            if (!configurationId || steps.length === 0) {
                throw new TranslatableError("errors.queryTable.scopeInvalid");
            }

            const stepMatch = steps
                .map((step) => `("study"."workflowId" = ${step.workflowId}`
                    + ` AND "study_step"."stepNumber" = ${step.stepNumber})`)
                .join(" OR ");
            const configurationMatch = sequelize.models.study_step.assessmentConfigurationSql("study_step");
            return {
                studyId: {
                    [Op.in]: sequelize.literal(
                        '(SELECT "study"."id" FROM "study"'
                        + ' INNER JOIN "study_step" ON "study_step"."studyId" = "study"."id"'
                        + ' AND "study_step"."deleted" = false'
                        + ' WHERE "study"."deleted" = false AND "study"."template" = false'
                        + ' AND "study"."closed" IS NOT NULL'
                        + (projectId ? ` AND "study"."projectId" = ${projectId}` : "")
                        + ` AND ${configurationMatch} = '${configurationId}'`
                        + ` AND (${stepMatch}))`
                    ),
                },
            };
        }

        /**
         * Session identity for queryTable rows and query-mode deltas.
         * @param {Object} ctx
         * @param {function(string): Promise<boolean>} ctx.hasAccess
         * @returns {Promise<Array<Object>>}
         */
        static async getQueryTableInjects(ctx) {
            const privateInfo = await ctx.hasAccess("frontend.dashboard.studies.view.userPrivateInfo");
            return [{
                type: "sql",
                table: "study_session",
                on: "id",
                fields: StudySession.sessionIdentitySql(privateInfo),
            }];
        }

        /**
         * Free-text keys for session picker columns
         * @param {Object} ctx
         * @param {function(string): Promise<boolean>} ctx.hasAccess
         * @returns {Promise<string[]>}
         */
        static async getQueryTableSearchColumns(ctx) {
            const columns = [
                "studyName", "userName", "ownerUserName",
                "workflowType", "submissionGroup", "status",
            ];
            if (await ctx.hasAccess("frontend.dashboard.studies.view.userPrivateInfo")) {
                columns.push(
                    "firstName", "lastName", "ownerFirstName", "ownerLastName",
                    "completeUserName", "studyCompleteUserName",
                );
            }
            return columns;
        }

        /**
         * Free text on identity expressions 
         */
        static getQueryTableSearchConditions(needle, ctx = {}) {
            const canSearch = typeof ctx.canSearch === "function" ? ctx.canSearch : () => true;
            const skip = new Set(["submissionId", "submissionExtId", "studyUserId"]);
            return Object.entries(StudySession.sessionIdentitySql(true))
                .filter(([key]) => !skip.has(key) && canSearch(key))
                .map(([, sql]) => includesCondition(literal(sql), needle));
        }

        /**
         * Session search-bar chips
         */
        static async getQueryTableFilterColumns(ctx = {}) {
            const privateInfo = typeof ctx.hasAccess === "function"
                && await ctx.hasAccess("frontend.dashboard.studies.view.userPrivateInfo");
            const columns = StudySession.sessionIdentitySql(privateInfo);
            const spec = {
                id: {type: "numeric", operators: ["=", ">", ">=", "<", "<=", "%"]},
                createdAt: {type: "date"},
                status: {type: "enum", values: ["Running", "Finished"], sql: columns.status},
            };
            for (const key of [
                "userName", "ownerUserName", "completeUserName", "studyCompleteUserName",
                "workflowType", "submissionGroup",
                "firstName", "lastName", "ownerFirstName", "ownerLastName",
            ]) {
                if (columns[key]) {
                    spec[key] = {type: "text", sql: columns[key]};
                }
            }
            if (columns.submissionId) {
                spec.submissionExtId = {
                    type: "numeric",
                    operators: ["=", ">", ">=", "<", "<=", "%"],
                    sql: `(SELECT "submission"."extId" FROM "submission"`
                        + ` WHERE "submission"."id" = ${columns.submissionId})`,
                };
            }
            return spec;
        }

        /**
         * Check if a new session can be created for a study
         * if not, throw an error
         * @param studyId
         * @param userId
         * @param options - Transaction options
         * @returns {Promise<void>}
         * @throws Error if session cannot be created
         */
        static async checkSessionAvailability(studyId, userId, options) {
            const study = await sequelize.models.study.getById(studyId, {transaction: options.transaction});
            if (!study) {
                throw new TranslatableError('errors.studies.studyNotFound');
            }
            // Check for limited study sessions
            if (study.limitSessions !== null && study.limitSessions > 0) {
                const totalExistingSessionCount = await StudySession.count({
                    where: {studyId: studyId}
                }, {transaction: options.transaction});
                if (totalExistingSessionCount >= study.limitSessions) {
                    throw new TranslatableError('errors.studies.sessionLimitExceeded', {limit: study.limitSessions});
                }
            }
            // Check for limited study sessions per user
            if (study.limitSessionsPerUser !== null && study.limitSessionsPerUser > 0) {
                const existingSessionCountPerUser = await StudySession.count({
                    where: {studyId: studyId, userId: userId}
                }, {transaction: options.transaction});
                if (existingSessionCountPerUser >= study.limitSessionsPerUser) {
                    throw new TranslatableError('errors.studies.sessionLimitPerUserExceeded', {limit: study.limitSessionsPerUser});
                }
            }
            // Check for study closed or end date and start date
            if (study.closed && Date.now() > new Date(study.end)) {
                throw new TranslatableError('errors.studies.studyClosed');
            }
            if (study.start !== null && new Date() < new Date(study.start)) {
                throw new TranslatableError('errors.studies.studyNotStarted');
            }
        }

        /**
         * Duplicate a study session along with its associated data (e.g., documents, edits) for a new user.
         *
         * @param {number} studySessionId - The ID of the study session to duplicate.
         * @param {number} overrides - An object containing any fields to override in the duplicated session (e.g., userId).
         * @param {Object} options - Additional options for the duplication process, including the database transaction.
         * @return {Promise<StudySession>} The newly created study session instance.
         *  @throws {Error} If the original study session is not found or if any database operation fails.
         */
        static async duplicateStudySession(studySessionId, overrides= {}, options) {
            const studySession = await this.getById(studySessionId, {transaction: options.transaction});
            if (!studySession) {
                throw new TranslatableError('errors.studies.studySession.notFound');
            }
            let data = {
                studyId: studySession.studyId,
                userId: null,
                creatorId: this.userId,
                studyStepId: studySession.studyStepId,
                numberSteps: studySession.numberSteps,
                studyStepIdMax: studySession.studyStepIdMax,
                parentStudySessionId: studySession.id,
                start: null,
                end: null,
            };

            data = Object.assign(data, overrides);
            
            const duplicatedSession = await this.add(data, {transaction: options.transaction});

            const studySteps = await sequelize.models.study_step.getAllByKey("studyId", studySession.studyId, {transaction: options.transaction});
            
            //copy document related to the study session
            for (const studyStep of studySteps) {
                if (studyStep.documentId) {
                    const document = await sequelize.models.document.getById(studyStep.documentId, {transaction: options.transaction});
                    if (document) {
                        await sequelize.models.document.duplicateDocumentData(
                            document,
                            document,
                            { studySessionId: studySession.id, studyStepId: studyStep.id },
                            duplicatedSession.id,
                            studyStep.id,
                            options
                        );
                    }
                }
             }
            return duplicatedSession;
        }

        static associate(models) {
            // define association here
            StudySession.belongsTo(models["study"], {
                foreignKey: "studyId", as: "study",
            });

            StudySession.belongsTo(models["user"], {
                foreignKey: "userId", as: "user",
            });

            StudySession.belongsTo(models["study_step"], {
                foreignKey: "studyStepId", as: "studyStep",
            });

            StudySession.belongsTo(models["study_step"], {
                foreignKey: "studyStepIdMax"
            });
        }
    }

    StudySession.init({
        hash: DataTypes.STRING,
        studyId: DataTypes.INTEGER,
        userId: DataTypes.INTEGER,
        studyStepId: DataTypes.INTEGER,
        numberSteps: DataTypes.INTEGER,
        studyStepIdMax: DataTypes.INTEGER,
        parentStudySessionId: DataTypes.INTEGER,
        start: DataTypes.DATE,
        end: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE
    }, {
        sequelize: sequelize, modelName: 'study_session', tableName: 'study_session', hooks: {
            beforeCreate: async (studySession, options) => {

                
                if(studySession.parentStudySessionId === null){
                    // check for study session availability
                    await StudySession.checkSessionAvailability(studySession.studyId, studySession.userId, options);
                }

                // get first step
                const firstStep = await sequelize.models.study_step.getFirstStep(studySession.studyId, {transaction:options.transaction});

                studySession.studyStepId = firstStep.id;
                studySession.numberSteps = 1;
                studySession.studyStepIdMax = firstStep.id

            },
            beforeUpdate: async (studySession, options) => {
                // Check if study step changed
                if (studySession._previousDataValues.studyStepId !== studySession.studyStepId) {
                    if(studySession.parentStudySessionId === null){
                        await sequelize.models.study.checkStudyOpen(studySession.studyId, options);
                    }
                    const studySteps = await sequelize.models.study_step.getAllByKey("studyId", studySession.studyId);

                    let stepInPreviousStepPath = false;
                    let studyStep = studySteps.find(step => step.id === studySession.studyStepId);

                    // Check for first time entry and document copying
                    const currentStep = await sequelize.models.study_step.findByPk(studySession.studyStepId, {
                        transaction: options.transaction
                    });

                    // Check if this step has an associated studyStepDocument
                    if (currentStep && currentStep.studyStepDocument) {
                        // Get the source document from the associated study step
                        const sourceStep = await sequelize.models.study_step.findByPk(currentStep.studyStepDocument, {
                            transaction: options.transaction
                        });

                        if (sourceStep) {
                            // Check if we already have edits for this step
                            const existingEdits = await sequelize.models.document_edit.findOne({
                                where: {
                                    studySessionId: studySession.id,
                                    studyStepId: studySession.studyStepId
                                },
                                transaction: options.transaction
                            });

                            if (!existingEdits) {
                                // Copy edits from document_edit
                                await sequelize.models.document_edit.copyEditsByStep(
                                    sourceStep,
                                    currentStep,
                                    studySession.id,
                                    options.transaction
                                );
                            }
                        }
                    }

                    while (studyStep && studyStep.studyStepPrevious !== null && !stepInPreviousStepPath) {
                        if (studyStep.studyStepPrevious === studySession._previousDataValues.studyStepIdMax) {
                            stepInPreviousStepPath = true;
                        } else {
                            studyStep = studySteps.find(step => step.id === studyStep.studyStepPrevious);
                        }

                        if (stepInPreviousStepPath) {
                            studySession.studyStepIdMax = studySession.studyStepId;
                        }

                    }
                    studySession.numberSteps = (studySession.numberSteps || 0) + 1;

                    // Set the start date if not already set
                    if (!studySession.start) {
                        studySession.start = new Date();
                    }
                }
            },
            afterUpdate: async (studySession, options) => {
                // If the study session is deleted, we should also delete the associated db columns
                if (studySession.deleted && !studySession._previousDataValues.deleted) {
                    // delete associated comments
                    const comments = await sequelize.models.comment.getAllByKey("studySessionId", studySession.id);
                    for (const comment of comments) {
                        await sequelize.models.comment.deleteById(comment.id, {transaction: options.transaction});
                    }
                    // delete associated annotations
                    const annotations = await sequelize.models.annotation.getAllByKey("studySessionId", studySession.id);
                    for (const annotation of annotations) {
                        await sequelize.models.annotation.deleteById(annotation.id, {transaction: options.transaction});
                    }
                }
            }
        },
        indexes: [
            {
            unique: false,
            fields: ["userId", "studyId"]
            }
        ]
    });
    StudySession.cache = new SequelizeSimpleCache({study_session: {limit: 50, ttl: false}});
    return StudySession.cache.init(StudySession);
};