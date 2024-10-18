'use strict';
const MetaModel = require("../MetaModel.js");

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

            StudySession.belongsTo(models["workflow_step"], {
                foreignKey: "workflowStepId",
                as: "workflowStep",
              });
        }
    }

    StudySession.init({
        hash: DataTypes.STRING,
        studyId: DataTypes.INTEGER,
        userId: DataTypes.INTEGER,
        workflowStepId: DataTypes.INTEGER,
        currentStep: DataTypes.INTEGER,
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
        hooks:{
            beforeCreate: async (studySession, options) => {
                try {
                    const existingSession = await sequelize.models.StudySession.findOne({
                        where: {
                            studyId: studySession.studyId,
                            userId: studySession.userId
                        }
                    });
            
                    if (existingSession) {
                        throw new Error('A session for this user and study already exists');
                    }
            
                    const study = await sequelize.models.study.findOne({ where:
                        { id: studySession.studyId } 
                        });

                    if (!study) {
                        throw new Error('Study not found');
                    }

                    const limitSessions = study.limitSessions;
                    const limitSessionsPerUser = study.limitSessionsPerUser;

                    if (limitSessions !== null) {
                        const totalexistingSessionCount = await StudySession.count({
                            where: {
                                studyId: studySession.studyId
                            }
                        });

                        if (totalexistingSessionCount >= limitSessions) {
                            throw new Error(`Cannot create more than ${limitSessions} sessions for this study.`);
                        }
                    }

                    if (limitSessionsPerUser !== null) {
                        const existingSessionCountPerUser = await StudySession.count({
                            where: {
                                studyId: studySession.studyId, userId: studySession.userId
                            }
                        });

                        if (existingSessionCountPerUser >= limitSessionsPerUser) {
                            throw new Error(`Cannot create more than ${limitSessionsPerUser} sessions for this user.`);
                        }
                    }

                    if(study.close !== null){    
                        if(Date.now() > study.close || (studySession.end !== null && studySession.end > study.end)){
                            throw new Error('This study is closed');                        
                        }              
                    }
                } catch (error) {
                        console.error(error);
                        throw new Error('Failed to create study session');
                    }        
                },
            beforeUpdate: async (studySession, options) => {
                try {
                    const study = await sequelize.models.study.findOne({
                        where: { id: studySession.studyId }
                    });

                    if (!study) {
                        throw new Error('Study not found');
                    }

                    if (studySession.end !== null && !study.multipleSubmit) {
                        throw new Error('This study does not allow multiple submissions.');
                    }

                    const now = Date.now();

                    if (study.closed !== null && now > study.closed || (studySession.end !== null && studySession.end > study.end)) {
                        throw new Error('Study is closed');
                    }

                    if (study.end !== null && now > new Date(study.end) || (studySession.end !== null && studySession.end > study.end)) {
                        throw new Error('Study has ended');
                    }
                } catch (error) {
                    console.error(error);
                    throw new Error('Cannot submit study session');
                }
            },
        }
            
    });
    return StudySession;
};