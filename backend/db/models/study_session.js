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

                try{

                const study = await sequelize.models.study.findOne({ where:
                     { id: studySession.studyId } 
                    });

                if (!study) {
                    throw new Error('Study not found');
                }

                const limitSessions = study.limitSessions;
                const limitSessionsPerUser = study.limitSessionsPerUser;

                if (limitSessions != null) {
                    const totalexistingSessionCount = await StudySession.count({
                        where: {
                            studyId: studySession.studyId
                        }
                    });

                    if (totalexistingSessionCount >= limitSessions) {
                        throw new Error(`Cannot create more than ${limitSessions} sessions for this study.`);
                    }
                }

                if (limitSessionsPerUser != null) {
                    const existingSessionCountPerUser = await StudySession.count({
                        where: {
                            studyId: studySession.studyId, userId: studySession.userId
                        }
                    });

                    if (existingSessionCountPerUser >= limitSessionsPerUser) {
                        throw new Error(`Cannot create more than ${limitSessionsPerUser} sessions for this user.`);
                    }
                }
              }catch (error) {
                    console.error(error);
                    throw new Error('Failed to create study session');
                }
                
            }
        }
            
    });
    return StudySession;
};