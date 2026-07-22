'use strict';
const MetaModel = require("../MetaModel.js");
const SequelizeSimpleCache = require("sequelize-simple-cache");
const TranslatableError = require("../../utils/TranslatableError");

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
                throw new Error('errors.studies.studyNotFound');
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
                throw new Error('errors.studies.studyClosed');
            }
            if (study.start !== null && new Date() < new Date(study.start)) {
                throw new Error('errors.studies.studyNotStarted');
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
                throw new Error('errors.studies.studySession.notFound');
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