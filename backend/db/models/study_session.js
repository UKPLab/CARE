'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class StudySession extends MetaModel {
        static autoTable = true;

        /**
         * Check if a new session can be created for a study
         * if not, throw an error
         * @param studyId
         * @param userId
         * @returns {Promise<void>}
         * @throws Error if session cannot be created
         */
        static async checkSessionAvailability(studyId, userId) {
            const study = await sequelize.models.study.getById(studyId);
            if (!study) {
                throw new Error('Study not found');
            }
            // Check for limited study sessions
            if (study.limitSessions !== null && study.limitSessions > 0) {
                const totalExistingSessionCount = await StudySession.count({
                    where: {studyId: studyId}
                });
                if (totalExistingSessionCount >= study.limitSessions) {
                    throw new Error(`Cannot create more than ${study.limitSessions} sessions for this study.`);
                }
            }
            // Check for limited study sessions per user
            if (study.limitSessionsPerUser !== null && study.limitSessionsPerUser > 0) {
                const existingSessionCountPerUser = await StudySession.count({
                    where: {studyId: studyId, userId: userId}
                });
                if (existingSessionCountPerUser >= study.limitSessionsPerUser) {
                    throw new Error(`Cannot create more than ${study.limitSessionsPerUser} sessions for this user.`);
                }
            }
            // Check for study closed or end date
            if (study.closed && Date.now() > new Date(study.end)) {
                throw new Error('This study is closed');
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
            beforeCreate: async (studySession) => {

                // check for study session availability
                await StudySession.checkSessionAvailability(studySession.studyId, studySession.userId);

                // get first step
                const firstStep = await sequelize.models.study_step.getFirstStep(studySession.studyId);

                studySession.studyStepId = firstStep.id;
                studySession.numberSteps = 1;
                studySession.studyStepIdMax = firstStep.id

                // Set the start date if not already set
                if (!studySession.start) {
                    studySession.start = new Date();
                }
            },
            beforeUpdate: async (studySession) => {

                // Check study is still open
                await sequelize.models.study.checkStudyOpen(studySession.studyId);

                // Check if study step changed
                if (studySession._previousDataValues.studyStepId !== studySession.studyStepId) {

                    const studySteps = await sequelize.models.study_step.getAllByKey("studyId", studySession.studyId);

                    let stepInPreviousStepPath = false;
                    let studyStep = studySteps.find(step => step.id === studySession.studyStepId);

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

                }

            },
        }
    });
    return StudySession;
};