'use strict';
const MetaModel = require("../MetaModel.js");
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
    class StudySession extends MetaModel {
        static autoTable = true;
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
            StudySession.belongsTo(models["study"], {
                foreignKey: "studyId",
                as: "study",
              });

            StudySession.belongsTo(models["user"], {
                foreignKey: "userId",
                as: "user",
              });

            StudySession.belongsTo(models["study_step"], {
                foreignKey: "studyStepId",
                as: "studyStep",
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
        sequelize: sequelize,
        modelName: 'study_session',
        tableName: 'study_session',
        hooks: { 
            beforeCreate: async (studySession, options) => {
                const transaction = options.transaction || await sequelize.transaction();

                try {
                    const study = await sequelize.models.study.findOne({ 
                        where: { id: studySession.studyId }
                    }, { transaction });

                    if (!study) {
                        throw new Error('Study not found');
                    }

                    const limitSessions = study.limitSessions;
                    const limitSessionsPerUser = study.limitSessionsPerUser;

                    if (limitSessions > null) {
                        const totalExistingSessionCount = await StudySession.count({
                            where: { studyId: studySession.studyId }
                        }, { transaction });

                        if (totalExistingSessionCount >= limitSessions) {
                            throw new Error(`Cannot create more than ${limitSessions} sessions for this study.`);
                        }
                    }

                    if (limitSessionsPerUser > null) {
                        const existingSessionCountPerUser = await StudySession.count({
                            where: { studyId: studySession.studyId, userId: studySession.userId }
                        }, { transaction });

                        if (existingSessionCountPerUser >= limitSessionsPerUser) {
                            throw new Error(`Cannot create more than ${limitSessionsPerUser} sessions for this user.`);
                        }
                    }
                                                            
                    const now = Date.now();
                    if (study.closed && now > new Date(study.closed)) {
                        throw new Error('This study is closed');
                    }

                    if (study.end && now > new Date(study.end)) {
                        throw new Error('This study has ended');
                    }

                    const firstStep = await sequelize.models.study_step.findOne({
                        where: { 
                            studyId: studySession.studyId,
                            studyStepPrevious: null 
                        },
                        order: [['id', 'ASC']]
                    }, { transaction });
                    if (!firstStep) throw new Error('First step not found in the workflow');
     
                    studySession.studyStepId = firstStep.id;
                    studySession.numberSteps = 1;
                    studySession.studyStepIdMax = firstStep.id

                    await transaction.commit();
                } catch (error) {
                    console.error("Error in beforeCreate hook:", error);
                    await transaction.rollback();
                    throw new Error('Failed to create study session');
                }
            },
            beforeUpdate: async (studySession, options) => {
                const transaction = options.transaction || await sequelize.transaction();
            
                try {
                    const currentSession = await sequelize.models.study_session.findOne({
                        where: { id: studySession.id },
                        transaction,
                    });
            
                    if (!currentSession) {
                        throw new Error('Study session not found');
                    }

                    const study = await sequelize.models.study.findOne({ 
                        where: { id: studySession.studyId }
                    }, { transaction });

                    const now = Date.now();
                    if (study.closed && now > new Date(study.closed)) {
                        throw new Error('This study is closed');
                    }

                    if (study.end && now > new Date(study.end)) {
                        throw new Error('This study has ended');
                    }             
                                         
                    if(study && !study.multipleSubmit){
                        if(currentSession.end !== studySession.end){
                            throw new Error(`Cannot submit this study session multiple times`);                        
                        }
                    }
            
                    const currentMaxStepId = currentSession.studyStepIdMax;

                    const studySteps = await sequelize.models.study_step.findAll({
                        where: { studyId: studySession.studyId },
                        transaction,
                    });

                    let stepInPreviousStepPath = false;
                    let studyStep = studySteps.find(step => step.id === studySession.studyStepId); 

                    while (studyStep && studyStep.studyStepPrevious !== null && !stepInPreviousStepPath) {
                        if (studyStep.studyStepPrevious === currentMaxStepId) {
                            stepInPreviousStepPath = true; 
                        } else {
                            studyStep = studySteps.find(step => step.id === studyStep.studyStepPrevious);
                        }
                    }

                    if (stepInPreviousStepPath) {
                        studySession.studyStepIdMax = studySession.studyStepId;
                    }

                    studySession.numberSteps = (studySession.numberSteps || 0) + 1;
            
                    await transaction.commit();
                } catch (error) {
                    console.error("Error in beforeUpdate hook:", error);
                    await transaction.rollback();
                    throw new Error('Cannot submit study session');
                }
            },
        }
    });
    return StudySession;
};