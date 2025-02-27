'use strict';
const MetaModel = require("../MetaModel.js");

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
                right: "frontend.dashboard.studies.view",
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
                throw new Error('Study not found');
            }
            // Check for limited study sessions
            if (study.limitSessions !== null && study.limitSessions > 0) {
                const totalExistingSessionCount = await StudySession.count({
                    where: {studyId: studyId}
                }, {transaction: options.transaction});
                if (totalExistingSessionCount >= study.limitSessions) {
                    throw new Error(`Cannot create more than ${study.limitSessions} sessions for this study.`);
                }
            }
            // Check for limited study sessions per user
            if (study.limitSessionsPerUser !== null && study.limitSessionsPerUser > 0) {
                const existingSessionCountPerUser = await StudySession.count({
                    where: {studyId: studyId, userId: userId}
                }, {transaction: options.transaction});
                if (existingSessionCountPerUser >= study.limitSessionsPerUser) {
                    throw new Error(`Cannot create more than ${study.limitSessionsPerUser} sessions for this user.`);
                }
            }
            // Check for study closed or end date and start date
            if (study.closed && Date.now() > new Date(study.end)) {
                throw new Error('This study is closed');
            }
            if (study.start !== null && new Date() < new Date(study.start)) {
                throw new Error('This study has not started yet');
            }
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
        start: DataTypes.DATE,
        end: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE
    }, {
        sequelize: sequelize, modelName: 'study_session', tableName: 'study_session', hooks: {
            beforeCreate: async (studySession, options) => {

                // check for study session availability
                await StudySession.checkSessionAvailability(studySession.studyId, studySession.userId, options);

                // get first step
                const firstStep = await sequelize.models.study_step.getFirstStep(studySession.studyId, {transaction:options.transaction});

                studySession.studyStepId = firstStep.id;
                studySession.numberSteps = 1;
                studySession.studyStepIdMax = firstStep.id

            },
            beforeUpdate: async (studySession, options) => {
                // Check if study step changed
                if (studySession._previousDataValues.studyStepId !== studySession.studyStepId) {
                    await sequelize.models.study.checkStudyOpen(studySession.studyId);

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
                                await sequelize.models.document_edit.copyEdits({
                                    sourceStep,
                                    currentStep,
                                    studySessionId: studySession.id,
                                    transaction: options.transaction
                                });
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
        }
    });
    return StudySession;
};