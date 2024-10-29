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
        hooks:{
            beforeCreate: async (studySession, options) => {
                const transaction = options.transaction || await sequelize.transaction();
            try {                 
                    const study = await sequelize.models.study.findOne({ where:
                        { id: studySession.studyId },
                        }, {transaction});

                    if (!study) {
                        throw new Error('Study not found');
                    }

                    const limitSessions = study.limitSessions;
                    const limitSessionsPerUser = study.limitSessionsPerUser;

                    if (limitSessions !== null && limitSessions > 0) {
                        let totalexistingSessionCount = await StudySession.count({
                            where: {
                                studyId: studySession.studyId
                            },
                        }, {transaction});

                        if (totalexistingSessionCount > limitSessions) {
                            throw new Error(`Cannot create more than ${limitSessions} sessions for this study.`);
                        }
                    }

                    if (limitSessionsPerUser !== null && limitSessionsPerUser > 0) {
                        let existingSessionCountPerUser = await StudySession.count({
                            where: {
                                studyId: studySession.studyId, userId: studySession.userId
                            },
                        }, {transaction});

                        if (existingSessionCountPerUser > limitSessionsPerUser) {
                            throw new Error(`Cannot create more than ${limitSessionsPerUser} sessions for this user.`);
                        }
                    }

                    if(study.close !== null || studySession.end !== null){    
                        if(Date.now() > study.close || studySession.end > study.end){
                            throw new Error('This study is closed');                        
                        }              
                    }

                    await transaction.commit();
                } catch (error) {
                        await transaction.rollback();
                        console.error(error);
                        throw new Error('Failed to create study session');
                }        
            },
            beforeUpdate: async (studySession, options) => {
                const transaction = options.transaction || await sequelize.transaction();

                try {                   

                    const study = await sequelize.models.study.findOne({
                        where: { id: studySession.studyId }
                    },
                    {transaction});

                    if (!study) {
                        throw new Error('Study not found');
                    }

                    if (studySession.end !== null && !study.multipleSubmit) {
                        throw new Error('This study does not allow multiple submissions.');
                    }

                    const now = Date.now();

                    if (study.closed !== null || studySession.end !== null) { 
                        if(now > study.closed || studySession.end > study.closed)
                            throw new Error('Study is closed');
                    }

                    if (study.end !== null || studySession.end !== null) { 
                        if(now > new Date(study.end) || studySession.end > study.end)
                            throw new Error('Study has ended');
                    }

                    await transaction.commit();
                } catch (error) {
                    await transaction.rollback();
                    console.error(error);
                    throw new Error('Cannot submit study session');
                }
            },
        }
            
    });
    return StudySession;
};