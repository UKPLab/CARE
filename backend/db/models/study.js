'use strict';
const MetaModel = require("../MetaModel.js");
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_PATH = `${__dirname}/../../../files`;

module.exports = (sequelize, DataTypes) => {
    class Study extends MetaModel {
        static autoTable = true;
        static fields = [
            {
                key: "name",
                label: "Name of the study:",
                placeholder: "My user study",
                type: "text",
                required: true,
                //pattern: "^(\\d+)",
                //invalidText: "Test invalid text",
                default: "",
                minlength: 4,
                maxlength: 5
            },
            {
                key: "workflowId", 
                label: "Select Workflow for Study:",
                type: "select", 
                options: {
                    table: "workflow", name: "name", value: "id"
                },
                icon: "list", 
                required: true,
                help: "Choose a workflow template for the study steps."
            },
            {
                key: "stepDocuments",
                label: "Assign Documents to Workflow Steps:",
                type: "choice",
                options: {
                    table: "study_step", id: "studyId", filter: {
                        table: "workflow_step"
                    } 
                },
                required: true,
            },
            {
                key: "description",
                label: "Description of the study:",
                help: "This text will be displayed at the beginning of the user study!",
                type: "editor",
                required: true
            },
            {
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
            },
            {
                key: "limitSessions",
                type: "slider",
                label: "Limit the number of sessions for the study:",
                help: "Set the maximum number of times participants can start or resume the study. Each attempt to complete the study is called a session. 0 = unlimited number of sessions.",
                size: 12,
                unit: "Sessions",
                min: 0, 
                max: 200,  
                step: 1,
                default: 100, 
            },
            {
                key: "limitSessionsPerUser",
                type: "slider",
                label: "Limit the number of sessions per user for the study:",
                help: "Set the maximum number of times each participant can start or resume the study. Each attempt to complete the study is called a session. 0 = unlimited number of sessions per user.",
                size: 12,
                unit: "Sessions",
                min: 0, 
                max: 200,  
                step: 1,
                default: 100, 
            },
            {
                key: "collab",
                label: "Should the study be collaborative?",
                type: "switch",
                default: false,
            },
            {
                key: "resumable",
                label: "Should the study be resumable?",
                type: "switch",
                default: false,
            },
            {
                key: "multipleSubmit",
                label: "Allow multiple submissions?",
                type: "switch",
                default: false,
                help: "Specify whether participants can submit their study multiple times."
            },
            {
                key: "start",
                label: "Study sessions can't start before",
                type: "datetime",
                size: 6,
                default: null,
            },
            {
                key: "end",
                label: "Study sessions can't start after:",
                type: "datetime",
                size: 6,
                default: null,
            },
        ];

        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
            Study.belongsTo(models["user"], {
                foreignKey: "userId",
                as: "user"
            });

            // Association with the workflow model
            Study.belongsTo(models["workflow"], {
                foreignKey: "workflowId",
                as: "workflow"
            });

            // Association with study sessions
            Study.hasMany(models["study_session"], {
                foreignKey: "studyId",
                as: "sessions"
            });

            // Association with study steps
            Study.hasMany(models["study_step"], {
                foreignKey: "studyId",
                as: "steps"
            });
        }
    }

    Study.init({
        name: DataTypes.STRING,
        hash: DataTypes.STRING,
        userId: DataTypes.INTEGER,
        createdByUserId: DataTypes.INTEGER,
        workflowId: DataTypes.INTEGER,
        collab: DataTypes.BOOLEAN,
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
        createdAt: DataTypes.DATE
    }, {
        sequelize: sequelize,
        modelName: 'study',
        tableName: 'study',
        hooks: {
            afterCreate: async (study, options) => {
                const transaction = options.transaction || await sequelize.transaction();

                if (study.template) {
                    console.log("Study is a template, skipping step update.");
                    return;
                }
                try {
                    const workflowSteps = await sequelize.models.workflow_step.findAll({
                        where: { workflowId: study.workflowId },
                        order: [['id', 'ASC']],
                        transaction
                    });

                    for (const step of workflowSteps) {
                        const stepDocument = options.context.stepDocuments.find(doc => doc.stepId === step.id);
                        let documentId = null;
            
                        if (stepDocument && stepDocument.documentId) {
                            const document = await sequelize.models.document.findByPk(stepDocument.documentId, { transaction });

                            if (!document) {
                                 throw new Error(`Document not found: documentId ${stepDocument.documentId} is missing for step ${step.id}. Cancelling transaction.`);
                            }
                            documentId = stepDocument.documentId;

                            if (step.stepType === 2) { // Editor
                                if (document.type !== 1) { // HTML
                                    throw new Error(`Document type mismatch: step ${step.id} expects an Editor document (type 1), but found type ${document.type}.`);
                                }

                                const originalFilePath = path.join(UPLOAD_PATH, `${document.hash}.delta.json`);
                                const newDocumentHash = `${document.hash}` + '_' + `${study.hash}`; 
                                const newFilePath = path.join(UPLOAD_PATH, `${newDocumentHash}.delta.json`);
    
                                await fs.copyFile(originalFilePath, newFilePath);
                                const newDocument = await sequelize.models.document.create({
                                    name: `${document.name}_study`,
                                    type: document.type,
                                    hash: newDocumentHash,
                                    userId: study.userId,
                                    parentDocumentId: document.id
                                }, { transaction });
        
                                documentId = newDocument.id; 
                            } 
                        }
                        await sequelize.models.study_step.create({
                            studyId: study.id,
                            workflowStepId: step.id,
                            documentId: documentId 
                        }, { transaction });
                    }
                    await transaction.commit();
                } catch (error) {
                    console.error("Failed during study step creation:", error);
                    await transaction.rollback();
                    throw new Error(`Failed to create study steps for the study: ${error.message}`);
                }
            },
            afterUpdate: async (study, options) => {
                const transaction = options.transaction || await sequelize.transaction();
    
                try {
                    const workflowSteps = await sequelize.models.workflow_step.findAll({
                        where: { workflowId: study.workflowId },
                        order: [['id', 'ASC']],
                        transaction
                    });
            
                    for (const step of workflowSteps) {
                        const studyStep = await sequelize.models.study_step.findOne({
                            where: { workflowStepId: step.id, studyId: study.id },
                            transaction
                        });
            
                        if (!studyStep) {
                            console.log(`No study_step found for workflowStepId: ${step.id}`);
                            continue;  
                        }

                        const stepDocument = options.context.stepDocuments.find(doc => doc.id === studyStep.id);

                        let documentId = null;

                        if (stepDocument && stepDocument.documentId) {
                            const document = await sequelize.models.document.findByPk(stepDocument.documentId, { transaction });
            
                            if (!document) {
                                throw new Error(`Document not found: documentId ${stepDocument.documentId} is missing for study_step ${studyStep.id}. Cancelling transaction.`);
                            }
            
                            documentId = stepDocument.documentId;
            
                            if (step.stepType === 2) { // Editor
                                if (document.type !== 1) { // HTML
                                    throw new Error(`Document type mismatch: step ${step.id} expects an Editor document (type 1), but found type ${document.type}.`);
                                }
            
                                const originalFilePath = path.join(UPLOAD_PATH, `${document.hash}.delta.json`);
                                const newDocumentHash = `${document.hash}_${study.hash}_${uuidv4()}`;
                                const newFilePath = path.join(UPLOAD_PATH, `${newDocumentHash}.delta.json`);
            
                                await fs.copyFile(originalFilePath, newFilePath);
            
                                const newDocument = await sequelize.models.document.create({
                                    name: `${document.name}_study`,
                                    type: document.type,
                                    hash: newDocumentHash,
                                    userId: study.userId,
                                    parentDocumentId: document.id
                                }, { transaction });
            
                                documentId = newDocument.id; 
                            }
                        }
            
                        await sequelize.models.study_step.update(
                            { documentId: documentId },
                            { where: { id: studyStep.id }, transaction }
                        );
                    }
                    await transaction.commit();
                } catch (error) {
                    console.error("Failed during document update:", error);
                    if (transaction) await transaction.rollback();
                    throw new Error(`Failed to update study steps for the study: ${error.message}`);
                }
            }
        }
    });

    return Study;
};
