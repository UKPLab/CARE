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
                                            
                    const study = await sequelize.models.study.findOne({ 
                        where: { id: studySession.studyId }
                    }, { transaction });

                    if (!study) {
                        throw new Error('Study not found');
                    }
                    
                    const now = Date.now();
                    if (study.closed && now > study.closed || studySession.end && now > studySession.end) {
                        throw new Error('This study is closed');
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

                    let documentId = firstStep.documentId;

                    if (!documentId) {
                        const newDocument = await sequelize.models.document.create({
                            name: `Document for study ${studySession.studyId}, step ${studySession.studyStepId}`,
                            type: 1, 
                            hash: uuidv4(), 
                            userId: study.userId,
                            content: "<html><body></body></html>"
                        }, { transaction });

                        documentId = newDocument.id;

                        await sequelize.models.study_step.update(
                            { documentId },
                            { where: { id: firstStep.id }, transaction }
                        );
                    }

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
                    const study = await sequelize.models.study.findOne({
                        where: { id: studySession.studyId }
                    }, { transaction });

                    if (!study) throw new Error('Study not found');
                    
                    const now = Date.now();
                    if (study.closed && now > study.closed || studySession.end && now > studySession.end) {
                        throw new Error('This study is closed');
                    }

                    studySession.numberSteps += 1;

                    const studySteps = await sequelize.models.study_step.findAll({
                        where: { studyId: studySession.studyId },
                        order: [['workflowStepId', 'ASC']]
                    }, { transaction });
            
                    const currentMaxStepIndex = studySteps.findIndex(step => step.id === studySession.studyStepIdMax);
            
                    const isNextStepValid = studySteps[currentMaxStepIndex + 1] && 
                                            studySteps[currentMaxStepIndex + 1].id === studySession.studyStepId;
            
                    if (isNextStepValid) {
                        studySession.studyStepIdMax = studySession.studyStepId;
                    }

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